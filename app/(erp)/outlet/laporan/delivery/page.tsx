"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Search,
  RefreshCw,
  Truck,
  Package,
  CalendarDays,
  FileText,
  Filter,
  XCircle,
  FileDown,
  Building2,
  ChevronDown,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  CircleDollarSign,
  Hash,
} from "lucide-react";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type Customer = {
  id: number;
  code: string;
  name: string;
};

type Barang = {
  id: number;
  code: string;
  name: string;
  unit: string;
  sellingPrice: number;
  purchasePrice: number;
};

type DeliveryItem = {
  id: number;
  barangId: number;
  qty: number;
  price: number;
  subtotal: number;
  note?: string | null;

  voided?: boolean;
  voidedAt?: string | null;
  voidReason?: string | null;

  barang: Barang;
};

type SuratJalan = {
  id: number;
  number: string;
  driver?: string | null;
  vehicleNumber?: string | null;
  expedition?: string | null;
  receiver?: string | null;
  receiveDate?: string | null;
};

type Delivery = {
  id: number;
  number: string;
  deliveryDate: string;
  status: string;
  remarks?: string | null;
  totalQty: number;

  customer: Customer;

  outlet?: Outlet | null;

  suratJalan?: SuratJalan | null;

  items: DeliveryItem[];
};

type ItemStatusFilter = "ALL" | "ACTIVE" | "VOID";

export default function OutletDeliveryReportPage() {
  const [data, setData] = useState<Delivery[]>([]);
  const [outlet, setOutlet] = useState<Outlet | null>(null);

  // =====================================================
  // ADMIN PUSAT
  // =====================================================

  const [isAdmin, setIsAdmin] = useState(false);

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] =
    useState<string>("");

  // =====================================================
  // FILTER TANGGAL
  // =====================================================

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // =====================================================
  // STATUS ITEM
  // =====================================================

  const [itemStatus, setItemStatus] =
    useState<ItemStatusFilter>("ALL");

  // =====================================================
  // SEARCH / LOADING
  // =====================================================

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // =====================================================
  // NOTIFICATION
  // =====================================================

  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!notification) return;

    const timer = window.setTimeout(() => {
      setNotification(null);
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [notification]);

  // =====================================================
  // LOAD DATA
  // =====================================================

  async function loadData() {
    try {
      setLoading(true);

      // =================================================
      // USER LOGIN
      // =================================================

      const meRes = await fetch("/api/me", {
        cache: "no-store",
      });

      const meJson = await meRes.json();

      if (!meRes.ok || !meJson.success) {
        throw new Error(
          meJson.message ||
            "Gagal mengambil user login"
        );
      }

      const loginUser = meJson.user;

      const role = String(
        loginUser?.role || ""
      ).toUpperCase();

      const adminPusat = role === "ADMIN";

      setIsAdmin(adminPusat);

      // =================================================
      // ADMIN PUSAT
      // =================================================

      if (adminPusat) {
        setOutlet(null);

        const res = await fetch(
          "/api/outlet/laporan/delivery",
          {
            cache: "no-store",
          }
        );

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(
            json.message ||
              "Gagal mengambil laporan Delivery Order"
          );
        }

        const deliveries: Delivery[] =
          Array.isArray(json.data)
            ? json.data
            : [];

        const releasedOnly =
          deliveries.filter(
            (delivery) =>
              String(
                delivery.status || ""
              ).toUpperCase() ===
              "RELEASED"
          );

        setData(releasedOnly);

        // =================================================
        // LIST OUTLET
        // =================================================

        if (Array.isArray(json.outlets)) {
          setOutlets(json.outlets);
        } else {
          const outletMap = new Map<
            number,
            Outlet
          >();

          releasedOnly.forEach(
            (delivery) => {
              if (delivery.outlet) {
                outletMap.set(
                  Number(
                    delivery.outlet.id
                  ),
                  {
                    id: Number(
                      delivery.outlet.id
                    ),
                    code:
                      delivery.outlet.code,
                    name:
                      delivery.outlet.name,
                  }
                );
              }
            }
          );

          setOutlets(
            Array.from(
              outletMap.values()
            ).sort((a, b) =>
              a.name.localeCompare(
                b.name
              )
            )
          );
        }

        return;
      }

      // =================================================
      // ADMIN OUTLET / USER OUTLET
      // =================================================

      if (
        !loginUser?.outletId ||
        !loginUser?.outlet
      ) {
        setOutlet(null);
        setData([]);
        return;
      }

      const loginOutlet: Outlet = {
        id: Number(
          loginUser.outlet.id
        ),
        code:
          loginUser.outlet.code,
        name:
          loginUser.outlet.name,
      };

      setOutlet(loginOutlet);

      const res = await fetch(
        `/api/outlet/laporan/delivery?outletId=${loginOutlet.id}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil laporan Delivery Order"
        );
      }

      const deliveries: Delivery[] =
        Array.isArray(json.data)
          ? json.data
          : [];

      const outletDeliveries =
        deliveries.filter(
          (delivery) =>
            Number(
              delivery.outlet?.id
            ) === loginOutlet.id &&
            String(
              delivery.status || ""
            ).toUpperCase() ===
              "RELEASED"
        );

      setData(outletDeliveries);
    } catch (error) {
      console.error(
        "LOAD OUTLET DELIVERY REPORT ERROR:",
        error
      );

      setData([]);

      setNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Gagal memuat laporan Delivery Order.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // =====================================================
  // CEK ITEM VOID
  // =====================================================

  function isItemVoided(
    item: DeliveryItem
  ) {
    return item.voided === true;
  }

  // =====================================================
  // FILTER STATUS ITEM
  // =====================================================

  function isItemMatchStatusFilter(
    item: DeliveryItem
  ) {
    if (itemStatus === "ALL") {
      return true;
    }

    if (itemStatus === "VOID") {
      return isItemVoided(item);
    }

    return !isItemVoided(item);
  }

  // =====================================================
  // FILTER ITEM
  // =====================================================

  function getFilteredItems(
    delivery: Delivery
  ) {
    return delivery.items.filter(
      (item) =>
        isItemMatchStatusFilter(item)
    );
  }

  // =====================================================
  // PRICE
  // =====================================================

  function getItemPrice(
    item: DeliveryItem
  ) {
    const deliveryPrice =
      Number(item.price || 0);

    if (deliveryPrice > 0) {
      return deliveryPrice;
    }

    const sellingPrice =
      Number(
        item.barang?.sellingPrice || 0
      );

    if (sellingPrice > 0) {
      return sellingPrice;
    }

    return Number(
      item.barang?.purchasePrice || 0
    );
  }

  // =====================================================
  // SUBTOTAL
  // =====================================================

  function getItemSubtotal(
    item: DeliveryItem
  ) {
    const subtotal =
      Number(item.subtotal || 0);

    if (subtotal > 0) {
      return subtotal;
    }

    return (
      Number(item.qty || 0) *
      getItemPrice(item)
    );
  }

  // =====================================================
  // TOTAL DO
  // VOID TIDAK DIHITUNG
  // =====================================================

  function getDeliveryTotal(
    delivery: Delivery
  ) {
    return getFilteredItems(
      delivery
    ).reduce(
      (sum, item) => {
        if (isItemVoided(item)) {
          return sum;
        }

        return (
          sum +
          getItemSubtotal(item)
        );
      },
      0
    );
  }

  // =====================================================
  // TOTAL QTY
  // VOID TIDAK DIHITUNG
  // =====================================================

  function getDeliveryQty(
    delivery: Delivery
  ) {
    return getFilteredItems(
      delivery
    ).reduce(
      (sum, item) => {
        if (isItemVoided(item)) {
          return sum;
        }

        return (
          sum +
          Number(item.qty || 0)
        );
      },
      0
    );
  }

  // =====================================================
  // TOTAL ITEM AKTIF
  // =====================================================

  function getActiveItemCount(
    delivery: Delivery
  ) {
    return getFilteredItems(
      delivery
    ).filter(
      (item) =>
        !isItemVoided(item)
    ).length;
  }

  // =====================================================
  // TOTAL ITEM VOID
  // =====================================================

  function getVoidedItemCount(
    delivery: Delivery
  ) {
    return getFilteredItems(
      delivery
    ).filter(
      (item) =>
        isItemVoided(item)
    ).length;
  }

  // =====================================================
  // NORMALIZE DATE
  // =====================================================

  function getDateOnly(
    value: string
  ) {
    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return null;
    }

    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
  }

  // =====================================================
  // FILTER DATA
  //
  // FILTER TANGGAL BERLAKU UNTUK:
  // ADMIN PUSAT + USER OUTLET
  // =====================================================

  const filteredData = useMemo(() => {
    const keyword =
      search.toLowerCase().trim();

    return data.filter(
      (delivery) => {
        // =============================================
        // FILTER OUTLET
        // =============================================

        if (
          isAdmin &&
          selectedOutletId
        ) {
          if (
            Number(
              delivery.outlet?.id
            ) !==
            Number(
              selectedOutletId
            )
          ) {
            return false;
          }
        }

        // =============================================
        // FILTER TANGGAL
        // BERLAKU SEMUA ROLE
        // =============================================

        const deliveryDate =
          getDateOnly(
            delivery.deliveryDate
          );

        if (!deliveryDate) {
          return false;
        }

        if (dateFrom) {
          const fromDate =
            new Date(
              `${dateFrom}T00:00:00`
            );

          if (
            deliveryDate <
            fromDate
          ) {
            return false;
          }
        }

        if (dateTo) {
          const toDate =
            new Date(
              `${dateTo}T23:59:59.999`
            );

          if (
            deliveryDate >
            toDate
          ) {
            return false;
          }
        }

        // =============================================
        // FILTER STATUS ITEM
        // =============================================

        const matchingItems =
          delivery.items.filter(
            (item) =>
              isItemMatchStatusFilter(
                item
              )
          );

        if (
          matchingItems.length === 0
        ) {
          return false;
        }

        // =============================================
        // SEARCH
        // =============================================

        if (!keyword) {
          return true;
        }

        const text = [
          delivery.number,

          delivery.customer?.code,

          delivery.customer?.name,

          delivery.outlet?.code,

          delivery.outlet?.name,

          delivery.suratJalan?.number,

          ...matchingItems.map(
            (item) =>
              `${item.barang?.code || ""} ${
                item.barang?.name || ""
              } ${
                isItemVoided(item)
                  ? "void"
                  : "aktif"
              }`
          ),
        ]
          .join(" ")
          .toLowerCase();

        return text.includes(
          keyword
        );
      }
    );
  }, [
    data,
    search,
    isAdmin,
    selectedOutletId,
    dateFrom,
    dateTo,
    itemStatus,
  ]);

  // =====================================================
  // FORMAT
  // =====================================================

  function formatNumber(
    value: number
  ) {
    return Number(
      value || 0
    ).toLocaleString("id-ID");
  }

  function formatRupiah(
    value: number
  ) {
    return `Rp ${formatNumber(
      value
    )}`;
  }

  function formatDate(
    value: string
  ) {
    if (!value) return "-";

    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "-";
    }

    return date.toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  // =====================================================
  // STATUS
  // =====================================================

  function statusLabel(
    status: string
  ) {
    switch (
      String(
        status
      ).toUpperCase()
    ) {
      case "RELEASED":
        return "Released";

      default:
        return status;
    }
  }

  function statusClass(
    status: string
  ) {
    switch (
      String(
        status
      ).toUpperCase()
    ) {
      case "RELEASED":
        return "bg-[#E8F4EC] text-[#2F7A4F]";

      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  // =====================================================
  // STATUS ITEM LABEL
  // =====================================================

  function itemStatusLabel() {
    switch (itemStatus) {
      case "ACTIVE":
        return "Aktif";

      case "VOID":
        return "VOID";

      default:
        return "Semua";
    }
  }

  // =====================================================
  // ACTIVE FILTER COUNT
  // =====================================================

  const activeFilterCount =
    [
      selectedOutletId,
      dateFrom,
      dateTo,
      search.trim(),
      itemStatus !== "ALL"
        ? itemStatus
        : "",
    ].filter(Boolean).length;

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalDelivery =
    filteredData.length;

  const totalQty =
    filteredData.reduce(
      (sum, delivery) =>
        sum +
        getDeliveryQty(
          delivery
        ),
      0
    );

  const totalValue =
    filteredData.reduce(
      (sum, delivery) =>
        sum +
        getDeliveryTotal(
          delivery
        ),
      0
    );

  const totalVoidedItems =
    filteredData.reduce(
      (sum, delivery) =>
        sum +
        getVoidedItemCount(
          delivery
        ),
      0
    );

  // =====================================================
  // RESET FILTER
  // =====================================================

  function resetFilter() {
    setSelectedOutletId("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setItemStatus("ALL");
  }

  // =====================================================
  // PDF EXPORT
  // =====================================================

  function exportPDF() {
    if (
      exporting ||
      filteredData.length === 0
    ) {
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

      const margin = 12;

      // =================================================
      // HEADER ACCENT
      // =================================================

      doc.setFillColor(
        73,
        127,
        112
      );

      doc.rect(
        0,
        0,
        pageWidth,
        3,
        "F"
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(20);

      doc.setTextColor(
        24,
        53,
        45
      );

      doc.text(
        "MGB",
        margin,
        15
      );

      doc.setFontSize(10);

      doc.text(
        "PT. MITRA GARAM BOGATAMA",
        margin,
        21
      );

      doc.setFontSize(15);

      doc.text(
        "LAPORAN DELIVERY ORDER",
        pageWidth - margin,
        15,
        {
          align: "right",
        }
      );

      doc.setFontSize(8);

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setTextColor(
        100,
        116,
        112
      );

      doc.text(
        "Delivery Order yang sudah di-release",
        pageWidth - margin,
        21,
        {
          align: "right",
        }
      );

      // =================================================
      // FILTER INFO
      // =================================================

      let filterY = 30;

      doc.setFillColor(
        246,
        248,
        247
      );

      doc.roundedRect(
        margin,
        filterY,
        pageWidth -
          margin * 2,
        19,
        3,
        3,
        "F"
      );

      doc.setFontSize(8);

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setTextColor(
        53,
        86,
        76
      );

      doc.text(
        "FILTER LAPORAN",
        margin + 5,
        filterY + 5
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setTextColor(
        80,
        90,
        86
      );

      const outletFilter =
        selectedOutletId
          ? outlets.find(
              (item) =>
                String(
                  item.id
                ) ===
                String(
                  selectedOutletId
                )
            )
          : null;

      const periode =
        dateFrom || dateTo
          ? `${dateFrom || "..."} s/d ${
              dateTo || "..."
            }`
          : "Semua tanggal";

      const outletText =
        outletFilter
          ? `${outletFilter.code} - ${outletFilter.name}`
          : isAdmin
            ? "Semua Outlet"
            : outlet
              ? `${outlet.code} - ${outlet.name}`
              : "-";

      doc.text(
        `Periode: ${periode}`,
        margin + 5,
        filterY + 11
      );

      doc.text(
        `Outlet: ${outletText}`,
        margin + 85,
        filterY + 11
      );

      doc.text(
        `Status Item: ${itemStatusLabel()}`,
        margin + 180,
        filterY + 11
      );

      doc.text(
        `Pencarian: ${
          search.trim() || "Tidak ada"
        }`,
        margin + 245,
        filterY + 11
      );

      // =================================================
      // SUMMARY
      // =================================================

      const summaryY =
        filterY + 24;

      const summaryGap = 4;

      const summaryWidth =
        (pageWidth -
          margin * 2 -
          summaryGap * 3) /
        4;

      const summaryItems = [
        {
          label: "TOTAL DELIVERY",
          value: formatNumber(
            totalDelivery
          ),
        },
        {
          label: "TOTAL QTY RELEASED",
          value: formatNumber(
            totalQty
          ),
        },
        {
          label: "NILAI DELIVERY",
          value: formatRupiah(
            totalValue
          ),
        },
        {
          label: "ITEM VOID",
          value: formatNumber(
            totalVoidedItems
          ),
        },
      ];

      summaryItems.forEach(
        (item, index) => {
          const x =
            margin +
            index *
              (summaryWidth +
                summaryGap);

          const isVoid =
            index === 3;

          doc.setFillColor(
            isVoid ? 251 : 234,
            isVoid ? 236 : 243,
            isVoid ? 236 : 239
          );

          doc.roundedRect(
            x,
            summaryY,
            summaryWidth,
            18,
            2.5,
            2.5,
            "F"
          );

          doc.setFontSize(7);

          doc.setFont(
            "helvetica",
            "bold"
          );

          doc.setTextColor(
            isVoid ? 180 : 73,
            isVoid ? 75 : 127,
            isVoid ? 75 : 112
          );

          doc.text(
            item.label,
            x + 4,
            summaryY + 6
          );

          doc.setFontSize(
            index === 2
              ? 10
              : 12
          );

          doc.setTextColor(
            24,
            53,
            45
          );

          doc.text(
            item.value,
            x + 4,
            summaryY + 13
          );
        }
      );

      // =================================================
      // TABLE DATA
      // =================================================

      const tableRows: string[][] = [];

      filteredData.forEach(
        (delivery) => {
          const filteredItems =
            getFilteredItems(
              delivery
            );

          filteredItems.forEach(
            (
              item,
              itemIndex
            ) => {
              const voided =
                isItemVoided(item);

              const subtotal =
                getItemSubtotal(
                  item
                );

              tableRows.push([
                itemIndex === 0
                  ? formatDate(
                      delivery.deliveryDate
                    )
                  : "",

                itemIndex === 0
                  ? delivery.number ||
                    "-"
                  : "",

                itemIndex === 0
                  ? delivery.suratJalan
                      ?.number ||
                    "-"
                  : "",

                itemIndex === 0
                  ? delivery.outlet
                    ? `${delivery.outlet.code} - ${delivery.outlet.name}`
                    : "-"
                  : "",

                `${voided ? "[VOID] " : ""}${
                  item.barang?.code ||
                  "-"
                } - ${
                  item.barang?.name ||
                  "-"
                }${
                  voided &&
                  item.voidReason
                    ? ` | ${item.voidReason}`
                    : ""
                }`,

                `${formatNumber(
                  Number(
                    item.qty || 0
                  )
                )} ${
                  item.barang
                    ?.unit || ""
                }`,

                voided
                  ? "TIDAK DIHITUNG"
                  : formatRupiah(
                      subtotal
                    ),

                voided
                  ? "VOID"
                  : "AKTIF",
              ]);
            }
          );
        }
      );

      // =================================================
      // TABLE
      // =================================================

      autoTable(doc, {
        startY:
          summaryY + 24,

        margin: {
          left: margin,
          right: margin,
        },

        head: [
          [
            "Tanggal",
            "Delivery Order",
            "Surat Jalan",
            "Outlet",
            "Barang",
            "Qty",
            "Subtotal",
            "Status Item",
          ],
        ],

        body: tableRows,

        theme: "grid",

        styles: {
          font: "helvetica",
          fontSize: 7,
          cellPadding: 2.5,
          lineColor: [
            220,
            230,
            225,
          ],
          lineWidth: 0.2,
          textColor: [
            45,
            65,
            58,
          ],
          valign: "middle",
        },

        headStyles: {
          fillColor: [
            73,
            127,
            112,
          ],
          textColor: [
            255,
            255,
            255,
          ],
          fontStyle: "bold",
          fontSize: 7,
        },

        alternateRowStyles: {
          fillColor: [
            249,
            251,
            250,
          ],
        },

        columnStyles: {
          0: {
            cellWidth: 24,
          },

          1: {
            cellWidth: 31,
          },

          2: {
            cellWidth: 31,
          },

          3: {
            cellWidth: 48,
          },

          4: {
            cellWidth: "auto",
          },

          5: {
            cellWidth: 23,
            halign: "right",
          },

          6: {
            cellWidth: 32,
            halign: "right",
          },

          7: {
            cellWidth: 24,
            halign: "center",
          },
        },

        didParseCell: (
          hookData
        ) => {
          if (
            hookData.section ===
              "body" &&
            hookData.row.raw
          ) {
            const row =
              hookData.row.raw as string[];

            const status =
              String(
                row[7] || ""
              ).toUpperCase();

            if (
              status === "VOID" ||
              String(
                row[4] || ""
              ).startsWith(
                "[VOID]"
              )
            ) {
              hookData.cell.styles.fillColor =
                [
                  255,
                  245,
                  245,
                ];

              hookData.cell.styles.textColor =
                [
                  159,
                  62,
                  62,
                ];

              hookData.cell.styles.fontStyle =
                "bold";
            }
          }
        },
      });

      // =================================================
      // FOOTER
      // =================================================

      const totalPages =
        (
          doc as any
        ).internal
          .getNumberOfPages();

      for (
        let page = 1;
        page <= totalPages;
        page++
      ) {
        doc.setPage(page);

        const footerY =
          pageHeight - 8;

        doc.setDrawColor(
          220,
          230,
          225
        );

        doc.line(
          margin,
          footerY - 3,
          pageWidth -
            margin,
          footerY - 3
        );

        doc.setFontSize(7);

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setTextColor(
          130,
          140,
          136
        );

        doc.text(
          "MGB Inventory & Distribution",
          margin,
          footerY
        );

        doc.text(
          `Halaman ${page} / ${totalPages}`,
          pageWidth -
            margin,
          footerY,
          {
            align: "right",
          }
        );
      }

      // =================================================
      // FILE NAME
      // =================================================

      const today =
        new Date()
          .toISOString()
          .slice(0, 10);

      const outletName =
        outletFilter?.code ||
        (!isAdmin
          ? outlet?.code
          : "SEMUA");

      const safeOutlet =
        String(
          outletName || "OUTLET"
        )
          .replace(
            /[^a-zA-Z0-9-_]/g,
            "-"
          )
          .toUpperCase();

      const safeStatus =
        itemStatusLabel()
          .replace(
            /[^a-zA-Z0-9-_]/g,
            "-"
          )
          .toUpperCase();

      const fileName =
        `Laporan-Delivery-Order-${safeOutlet}-${safeStatus}-${today}.pdf`;

      doc.save(fileName);

      setNotification({
        type: "success",
        message:
          "PDF laporan berhasil dibuat dan diunduh.",
      });
    } catch (error) {
      console.error(
        "EXPORT DELIVERY PDF ERROR:",
        error
      );

      setNotification({
        type: "error",
        message:
          "Gagal membuat PDF laporan Delivery Order.",
      });
    } finally {
      setExporting(false);
    }
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-full bg-[#F4F7F5] p-4 md:p-6 lg:p-8">

      {/* =================================================
          NOTIFICATION
      ================================================= */}

      {notification && (
        <div className="fixed right-5 top-5 z-[100] w-[min(420px,calc(100vw-32px))]">
          <div
            className={`flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-2xl ${
              notification.type ===
              "success"
                ? "border-[#CDE4D8]"
                : "border-[#F0CCCC]"
            }`}
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                notification.type ===
                "success"
                  ? "bg-[#EAF4EE] text-[#2F7A4F]"
                  : "bg-[#FBECEC] text-[#B44B4B]"
              }`}
            >
              {notification.type ===
              "success" ? (
                <CheckCircle2
                  size={18}
                />
              ) : (
                <AlertCircle
                  size={18}
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#18352D]">
                {notification.type ===
                "success"
                  ? "Berhasil"
                  : "Terjadi Kesalahan"}
              </p>

              <p className="mt-0.5 text-xs leading-5 text-gray-500">
                {
                  notification.message
                }
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setNotification(
                  null
                )
              }
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <XCircle
                size={16}
              />
            </button>
          </div>
        </div>
      )}

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="relative mb-6 overflow-hidden rounded-[26px] border border-[#DCE8E2] bg-white shadow-sm">

        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#497F70]/5 blur-3xl" />

        <div className="relative flex flex-col gap-5 p-5 md:p-6 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex items-start gap-4">

            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#497F70] to-[#315F52] text-white shadow-lg shadow-[#497F70]/20">
              <Truck
                size={25}
              />

              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#18352D]">
                <CheckCircle2
                  size={11}
                />
              </span>
            </div>

            <div className="min-w-0">

              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#EAF3EF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#497F70]">
                  Distribution Report
                </span>

                {activeFilterCount >
                  0 && (
                  <span className="rounded-full bg-[#18352D] px-2.5 py-1 text-[10px] font-bold text-white">
                    {
                      activeFilterCount
                    }{" "}
                    filter aktif
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-black tracking-tight text-[#18352D] md:text-3xl">
                Laporan Delivery
                Order
              </h1>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                Monitoring Delivery Order
                yang telah di-release,
                termasuk detail barang,
                quantity, nilai delivery,
                dan item VOID.
              </p>

              {!isAdmin &&
                outlet && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#DDE9E4] bg-[#F8FBF9] px-3 py-2">
                    <Building2
                      size={14}
                      className="text-[#497F70]"
                    />

                    <span className="text-xs font-bold text-[#35564C]">
                      {outlet.code}
                    </span>

                    <span className="text-xs text-gray-400">
                      •
                    </span>

                    <span className="text-xs font-medium text-gray-600">
                      {outlet.name}
                    </span>
                  </div>
                )}

              {isAdmin && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#DDE9E4] bg-[#F8FBF9] px-3 py-2">
                  <Building2
                    size={14}
                    className="text-[#497F70]"
                  />

                  <span className="text-xs font-bold text-[#35564C]">
                    Admin Pusat
                  </span>

                  <span className="text-xs text-gray-400">
                    •
                  </span>

                  <span className="text-xs font-medium text-gray-600">
                    Monitoring semua
                    outlet
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            <button
              type="button"
              onClick={exportPDF}
              disabled={
                exporting ||
                loading ||
                filteredData.length === 0
              }
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#497F70]/15 transition hover:-translate-y-0.5 hover:bg-[#3F7062] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <FileDown
                size={16}
                className={
                  exporting
                    ? "animate-pulse"
                    : "transition group-hover:translate-y-0.5"
                }
              />

              {exporting
                ? "Membuat PDF..."
                : "Download PDF"}
            </button>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DDE9E4] bg-white px-4 py-2.5 text-sm font-bold text-[#35564C] shadow-sm transition hover:border-[#BFD6CC] hover:bg-[#F7FAF8] disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>
        </div>
      </div>

      {/* =================================================
          SUMMARY
      ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* TOTAL DELIVERY */}

        <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">

          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#497F70]/5" />

          <div className="relative flex items-center justify-between">

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                Total Delivery
              </p>

              <p className="mt-2 text-2xl font-black tracking-tight text-[#18352D]">
                {formatNumber(
                  totalDelivery
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                DO released
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70] transition group-hover:scale-105">
              <Truck size={20} />
            </div>
          </div>
        </div>

        {/* TOTAL QTY */}

        <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">

          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#497F70]/5" />

          <div className="relative flex items-center justify-between">

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                Total Qty
              </p>

              <p className="mt-2 text-2xl font-black tracking-tight text-[#18352D]">
                {formatNumber(
                  totalQty
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Qty aktif released
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70] transition group-hover:scale-105">
              <Package size={20} />
            </div>
          </div>
        </div>

        {/* TOTAL VALUE */}

        <div className="group relative overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">

          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#497F70]/5" />

          <div className="relative flex items-center justify-between gap-3">

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                Nilai Delivery
              </p>

              <p className="mt-2 truncate text-xl font-black tracking-tight text-[#18352D]">
                {formatRupiah(
                  totalValue
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Tidak termasuk VOID
              </p>
            </div>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70] transition group-hover:scale-105">
              <CircleDollarSign
                size={20}
              />
            </div>
          </div>
        </div>

        {/* TOTAL VOID */}

        <div className="group relative overflow-hidden rounded-2xl border border-[#F0D8D8] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">

          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#B44B4B]/5" />

          <div className="relative flex items-center justify-between">

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                Item VOID
              </p>

              <p className="mt-2 text-2xl font-black tracking-tight text-[#B44B4B]">
                {formatNumber(
                  totalVoidedItems
                )}
              </p>

              <p className="mt-1 text-xs text-[#B44B4B]/60">
                Tidak dihitung total
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FBECEC] text-[#B44B4B] transition group-hover:scale-105">
              <XCircle size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* =================================================
          REPORT TABLE CARD
      ================================================= */}

      <div className="overflow-hidden rounded-[24px] border border-[#DDE9E4] bg-white shadow-sm">

        {/* =================================================
            TOOLBAR
        ================================================= */}

        <div className="border-b border-[#E5ECE9] p-5 md:p-6">

          <div className="flex flex-col gap-5">

            {/* TITLE + SEARCH */}

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                  <FileText size={20} />
                </div>

                <div>
                  <h2 className="font-black text-[#18352D]">
                    Delivery Order
                    Outlet
                  </h2>

                  <p className="mt-0.5 text-xs text-gray-500">
                    {filteredData.length}{" "}
                    delivery ditemukan
                    sesuai filter
                  </p>
                </div>
              </div>

              <div className="relative w-full lg:w-[360px]">

                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Cari DO, barang, outlet..."
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-10 text-sm font-medium text-[#35564C] outline-none transition placeholder:text-gray-400 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <XCircle
                      size={16}
                    />
                  </button>
                )}
              </div>
            </div>

            {/* =================================================
                FILTER PANEL
            ================================================= */}

            <div className="rounded-2xl border border-[#DDE9E4] bg-gradient-to-br from-[#F8FBF9] to-[#F4F8F6] p-4 md:p-5">

              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#497F70] shadow-sm">
                    <Filter size={17} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-[#18352D]">
                        Filter Laporan
                      </p>

                      {activeFilterCount >
                        0 && (
                        <span className="rounded-full bg-[#497F70] px-2 py-0.5 text-[10px] font-black text-white">
                          {
                            activeFilterCount
                          }
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 text-xs text-gray-400">
                      Atur periode, outlet,
                      dan status item
                    </p>
                  </div>
                </div>

                {activeFilterCount >
                  0 && (
                  <button
                    type="button"
                    onClick={
                      resetFilter
                    }
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#DDE9E4] bg-white px-3 py-2 text-xs font-bold text-[#497F70] shadow-sm transition hover:bg-[#F1F6F3]"
                  >
                    <RotateCcw
                      size={13}
                    />
                    Reset Semua
                  </button>
                )}
              </div>

              {/* =================================================
                  FILTER GRID
              ================================================= */}

              <div
                className={`grid grid-cols-1 gap-3 ${
                  isAdmin
                    ? "md:grid-cols-2 xl:grid-cols-4"
                    : "md:grid-cols-2 xl:grid-cols-3"
                }`}
              >

                {/* OUTLET ADMIN */}

                {isAdmin && (
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-[#35564C]">
                      <Building2
                        size={13}
                      />
                      Outlet
                    </label>

                    <div className="relative">
                      <select
                        value={
                          selectedOutletId
                        }
                        onChange={(e) =>
                          setSelectedOutletId(
                            e.target
                              .value
                          )
                        }
                        className="w-full appearance-none rounded-xl border border-[#D5E5DC] bg-white px-3 py-2.5 pr-9 text-sm font-medium text-[#35564C] outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                      >
                        <option value="">
                          Semua Outlet
                        </option>

                        {outlets.map(
                          (item) => (
                            <option
                              key={
                                item.id
                              }
                              value={
                                item.id
                              }
                            >
                              {
                                item.code
                              }{" "}
                              -{" "}
                              {
                                item.name
                              }
                            </option>
                          )
                        )}
                      </select>

                      <ChevronDown
                        size={15}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                    </div>
                  </div>
                )}

                {/* TANGGAL DARI */}

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-[#35564C]">
                    <CalendarDays
                      size={13}
                    />
                    Tanggal Dari
                  </label>

                  <div className="relative">
                    <CalendarDays
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      type="date"
                      value={
                        dateFrom
                      }
                      onChange={(e) =>
                        setDateFrom(
                          e.target
                            .value
                        )
                      }
                      className="w-full rounded-xl border border-[#D5E5DC] bg-white py-2.5 pl-9 pr-3 text-sm font-medium text-[#35564C] outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                    />
                  </div>
                </div>

                {/* TANGGAL SAMPAI */}

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-[#35564C]">
                    <CalendarDays
                      size={13}
                    />
                    Tanggal Sampai
                  </label>

                  <div className="relative">
                    <CalendarDays
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      type="date"
                      value={dateTo}
                      min={
                        dateFrom ||
                        undefined
                      }
                      onChange={(e) =>
                        setDateTo(
                          e.target
                            .value
                        )
                      }
                      className="w-full rounded-xl border border-[#D5E5DC] bg-white py-2.5 pl-9 pr-3 text-sm font-medium text-[#35564C] outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                    />
                  </div>
                </div>

                {/* STATUS ITEM */}

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-[#35564C]">
                    <Hash
                      size={13}
                    />
                    Status Item
                  </label>

                  <div className="relative">
                    <select
                      value={
                        itemStatus
                      }
                      onChange={(e) =>
                        setItemStatus(
                          e.target
                            .value as ItemStatusFilter
                        )
                      }
                      className="w-full appearance-none rounded-xl border border-[#D5E5DC] bg-white px-3 py-2.5 pr-9 text-sm font-medium text-[#35564C] outline-none transition focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/10"
                    >
                      <option value="ALL">
                        Semua Item
                      </option>

                      <option value="ACTIVE">
                        Aktif
                      </option>

                      <option value="VOID">
                        VOID
                      </option>
                    </select>

                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                  </div>
                </div>
              </div>

              {/* =================================================
                  FILTER CHIPS
              ================================================= */}

              {(dateFrom ||
                dateTo ||
                selectedOutletId ||
                itemStatus !==
                  "ALL" ||
                search.trim()) && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#DDE9E4] pt-4">

                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Filter aktif:
                  </span>

                  {selectedOutletId && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#35564C] shadow-sm ring-1 ring-[#DDE9E4]">
                      <Building2
                        size={11}
                      />
                      {
                        outlets.find(
                          (item) =>
                            String(
                              item.id
                            ) ===
                            String(
                              selectedOutletId
                            )
                        )?.code
                      }
                    </span>
                  )}

                  {(dateFrom ||
                    dateTo) && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#35564C] shadow-sm ring-1 ring-[#DDE9E4]">
                      <CalendarDays
                        size={11}
                      />
                      {dateFrom ||
                        "..."}{" "}
                      →{" "}
                      {dateTo ||
                        "..."}
                    </span>
                  )}

                  {itemStatus !==
                    "ALL" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#35564C] shadow-sm ring-1 ring-[#DDE9E4]">
                      <Hash
                        size={11}
                      />
                      {
                        itemStatusLabel()
                      }
                    </span>
                  )}

                  {search.trim() && (
                    <span className="inline-flex max-w-[220px] items-center gap-1.5 truncate rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#35564C] shadow-sm ring-1 ring-[#DDE9E4]">
                      <Search
                        size={11}
                      />
                      <span className="truncate">
                        {search.trim()}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1300px] text-sm">

            <thead className="sticky top-0 z-10">

              <tr className="border-b border-[#DDE9E4] bg-[#F5F8F6]">

                <th className="w-[120px] px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.12em] text-[#35564C]">
                  Tanggal
                </th>

                <th className="w-[160px] px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.12em] text-[#35564C]">
                  Delivery Order
                </th>

                <th className="w-[160px] px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.12em] text-[#35564C]">
                  Surat Jalan
                </th>

                <th className="w-[180px] px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.12em] text-[#35564C]">
                  Outlet
                </th>

                <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.12em] text-[#35564C]">
                  Detail Barang
                </th>

                <th className="w-[120px] px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.12em] text-[#35564C]">
                  Total Qty
                </th>

                <th className="w-[170px] px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.12em] text-[#35564C]">
                  Total DO
                </th>

                <th className="w-[130px] px-5 py-4 text-center text-[10px] font-black uppercase tracking-[0.12em] text-[#35564C]">
                  Status
                </th>

              </tr>
            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-20 text-center"
                  >
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3EF]">
                      <RefreshCw
                        size={21}
                        className="animate-spin text-[#497F70]"
                      />
                    </div>

                    <p className="text-sm font-bold text-[#35564C]">
                      Memuat laporan...
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      Sedang mengambil
                      data Delivery
                      Order.
                    </p>
                  </td>
                </tr>
              ) : filteredData.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-20 text-center"
                  >
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2F5F3] text-gray-300">
                      <FileText
                        size={25}
                      />
                    </div>

                    <p className="text-sm font-bold text-[#35564C]">
                      Tidak ada data
                    </p>

                    <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-gray-400">
                      Tidak ditemukan
                      Delivery Order
                      RELEASED yang
                      sesuai dengan
                      filter yang
                      dipilih.
                    </p>

                    {activeFilterCount >
                      0 && (
                      <button
                        type="button"
                        onClick={
                          resetFilter
                        }
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-4 py-2 text-xs font-bold text-white hover:bg-[#3F7062]"
                      >
                        <RotateCcw
                          size={13}
                        />
                        Reset Filter
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredData.map(
                  (delivery) => {
                    const visibleItems =
                      getFilteredItems(
                        delivery
                      );

                    const totalDO =
                      getDeliveryTotal(
                        delivery
                      );

                    const totalQtyDO =
                      getDeliveryQty(
                        delivery
                      );

                    const activeItemCount =
                      getActiveItemCount(
                        delivery
                      );

                    const voidItemCount =
                      getVoidedItemCount(
                        delivery
                      );

                    return (
                      <tr
                        key={
                          delivery.id
                        }
                        className="group border-b border-[#EDF2EF] align-top transition hover:bg-[#FBFDFC]"
                      >

                        {/* TANGGAL */}

                        <td className="px-5 py-5">

                          <div className="flex items-start gap-2.5">

                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                              <CalendarDays
                                size={14}
                              />
                            </div>

                            <div>
                              <div className="font-bold text-[#35564C]">
                                {formatDate(
                                  delivery.deliveryDate
                                )}
                              </div>

                              <div className="mt-1 text-[10px] font-medium text-gray-400">
                                Release
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* DELIVERY ORDER */}

                        <td className="px-5 py-5">

                          <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#F2F7F4] px-2.5 py-1.5">
                            <Hash
                              size={12}
                              className="text-[#497F70]"
                            />

                            <span className="font-black text-[#18352D]">
                              {
                                delivery.number
                              }
                            </span>
                          </div>

                          {delivery.remarks && (
                            <div className="mt-2 max-w-[150px] text-xs leading-5 text-gray-400">
                              {
                                delivery.remarks
                              }
                            </div>
                          )}
                        </td>

                        {/* SURAT JALAN */}

                        <td className="px-5 py-5">

                          <div className="font-bold text-[#35564C]">
                            {
                              delivery
                                .suratJalan
                                ?.number ||
                              "-"
                            }
                          </div>

                          {delivery
                            .suratJalan
                            ?.driver && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                              <Truck
                                size={12}
                              />
                              {
                                delivery
                                  .suratJalan
                                  .driver
                              }
                            </div>
                          )}

                          {delivery
                            .suratJalan
                            ?.vehicleNumber && (
                            <div className="mt-1 text-[11px] font-medium text-gray-400">
                              {
                                delivery
                                  .suratJalan
                                  .vehicleNumber
                              }
                            </div>
                          )}
                        </td>

                        {/* OUTLET */}

                        <td className="px-5 py-5">

                          <div className="flex items-start gap-2.5">

                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F3] text-[#497F70]">
                              <Building2
                                size={14}
                              />
                            </div>

                            <div className="min-w-0">
                              <div className="font-bold text-[#18352D]">
                                {
                                  delivery
                                    .outlet
                                    ?.name ||
                                  "-"
                                }
                              </div>

                              <div className="mt-1 inline-flex rounded-full bg-[#F3F6F4] px-2 py-0.5 text-[10px] font-bold text-gray-500">
                                {
                                  delivery
                                    .outlet
                                    ?.code ||
                                  "-"
                                }
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* DETAIL BARANG */}

                        <td className="px-5 py-4">

                          <div className="space-y-2">

                            {visibleItems.map(
                              (
                                item
                              ) => {
                                const harga =
                                  getItemPrice(
                                    item
                                  );

                                const subtotal =
                                  getItemSubtotal(
                                    item
                                  );

                                const voided =
                                  isItemVoided(
                                    item
                                  );

                                return (
                                  <div
                                    key={
                                      item.id
                                    }
                                    className={`rounded-xl border px-3.5 py-3 transition ${
                                      voided
                                        ? "border-[#E7BABA] bg-[#FFF7F7]"
                                        : "border-[#E5ECE9] bg-[#FAFCFB] hover:border-[#CFE0D8]"
                                    }`}
                                  >

                                    <div className="flex items-start justify-between gap-4">

                                      <div className="min-w-0">

                                        <div
                                          className={`flex items-center gap-2 font-bold ${
                                            voided
                                              ? "text-[#9F3E3E]"
                                              : "text-[#18352D]"
                                          }`}
                                        >

                                          <Package
                                            size={
                                              14
                                            }
                                            className={
                                              voided
                                                ? "shrink-0 text-[#B44B4B]"
                                                : "shrink-0 text-[#497F70]"
                                            }
                                          />

                                          <span
                                            className={
                                              voided
                                                ? "truncate line-through"
                                                : "truncate"
                                            }
                                          >
                                            {
                                              item
                                                .barang
                                                ?.name
                                            }
                                          </span>

                                          {voided && (
                                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#B44B4B] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                                              <XCircle
                                                size={
                                                  10
                                                }
                                              />
                                              VOID
                                            </span>
                                          )}
                                        </div>

                                        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                          {
                                            item
                                              .barang
                                              ?.code
                                          }
                                        </div>

                                        {voided &&
                                          item
                                            .voidReason && (
                                            <div className="mt-1.5 rounded-lg bg-[#FBECEC] px-2 py-1 text-[10px] font-semibold text-[#B44B4B]">
                                              Alasan:{" "}
                                              {
                                                item
                                                  .voidReason
                                              }
                                            </div>
                                          )}
                                      </div>

                                      <div className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-right shadow-sm ring-1 ring-[#E5ECE9]">
                                        <div
                                          className={`text-sm font-black ${
                                            voided
                                              ? "text-[#B44B4B] line-through"
                                              : "text-[#35564C]"
                                          }`}
                                        >
                                          {formatNumber(
                                            item.qty
                                          )}{" "}
                                          {
                                            item
                                              .barang
                                              ?.unit
                                          }
                                        </div>
                                      </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between border-t border-[#E8EFEB] pt-2.5 text-xs">

                                      <span
                                        className={
                                          voided
                                            ? "text-[#B44B4B] line-through"
                                            : "text-gray-400"
                                        }
                                      >
                                        {formatRupiah(
                                          harga
                                        )}{" "}
                                        /{" "}
                                        {
                                          item
                                            .barang
                                            ?.unit
                                        }
                                      </span>

                                      <span
                                        className={`font-black ${
                                          voided
                                            ? "text-[#B44B4B] line-through"
                                            : "text-[#18352D]"
                                        }`}
                                      >
                                        {formatRupiah(
                                          subtotal
                                        )}
                                      </span>
                                    </div>

                                    {voided && (
                                      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#FBECEC] px-2.5 py-1.5 text-[10px] font-bold text-[#B44B4B]">
                                        <AlertCircle
                                          size={
                                            12
                                          }
                                        />
                                        Item VOID
                                        tidak
                                        dihitung
                                        dalam total
                                        delivery.
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </td>

                        {/* TOTAL QTY */}

                        <td className="px-5 py-5 text-right">

                          <div className="font-black text-[#18352D]">
                            {formatNumber(
                              totalQtyDO
                            )}
                          </div>

                          <div className="mt-1 text-[10px] font-medium text-gray-400">
                            {
                              activeItemCount
                            }{" "}
                            item aktif
                          </div>

                          {voidItemCount >
                            0 && (
                            <div className="mt-1.5 inline-flex rounded-full bg-[#FBECEC] px-2 py-0.5 text-[10px] font-bold text-[#B44B4B]">
                              {
                                voidItemCount
                              }{" "}
                              VOID
                            </div>
                          )}
                        </td>

                        {/* TOTAL DO */}

                        <td className="px-5 py-5 text-right">

                          <div className="rounded-xl border border-[#D8E9E1] bg-gradient-to-br from-[#EDF6F1] to-[#F7FAF8] px-3 py-3">

                            <div className="text-[9px] font-black uppercase tracking-wider text-[#497F70]">
                              Total Delivery
                            </div>

                            <div className="mt-1 whitespace-nowrap text-base font-black text-[#18352D]">
                              {formatRupiah(
                                totalDO
                              )}
                            </div>
                          </div>

                          {voidItemCount >
                            0 && (
                            <div className="mt-2 text-[9px] font-bold text-[#B44B4B]">
                              Tidak termasuk
                              item VOID
                            </div>
                          )}
                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-5 text-center">

                          <span
                            className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${statusClass(
                              delivery.status
                            )}`}
                          >
                            <CheckCircle2
                              size={12}
                            />

                            {statusLabel(
                              delivery.status
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>

        {/* =================================================
            FOOTER TABLE
        ================================================= */}

        {!loading &&
          filteredData.length >
            0 && (
            <div className="flex flex-col gap-2 border-t border-[#E5ECE9] bg-[#FAFCFB] px-5 py-3 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between md:px-6">

              <div className="flex items-center gap-2">
                <CheckCircle2
                  size={14}
                  className="text-[#497F70]"
                />

                <span>
                  Menampilkan{" "}
                  <strong className="text-[#35564C]">
                    {
                      filteredData.length
                    }
                  </strong>{" "}
                  Delivery Order
                </span>
              </div>

              <div className="flex items-center gap-3">
                {(dateFrom ||
                  dateTo) && (
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <CalendarDays
                      size={12}
                    />
                    {dateFrom ||
                      "..."}{" "}
                    →{" "}
                    {dateTo ||
                      "..."}
                  </span>
                )}

                <span>
                  Status:{" "}
                  <strong className="text-[#35564C]">
                    {
                      itemStatusLabel()
                    }
                  </strong>
                </span>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}