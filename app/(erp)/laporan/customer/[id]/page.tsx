"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  ArrowLeft,
  RefreshCw,
  FileText,
  Users,
  ShoppingCart,
  Package,
  Wallet,
  CalendarDays,
  Download,
  Printer,
  Mail,
  Phone,
  MapPin,
  Search,
  RotateCcw,
  FileSpreadsheet,
  FileDown,
  ChevronDown,
} from "lucide-react";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { exportReportExcel } from "@/lib/exportReportExcel";

type Customer = {
  id: number;
  code?: string | null;
  name: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

export default function DetailCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [customer, setCustomer] =
    useState<Customer | null>(null);

  const [deliveries, setDeliveries] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [from, setFrom] =
    useState("");

  const [to, setTo] =
    useState("");

  const [searchDO, setSearchDO] =
    useState("");

  const [customerId, setCustomerId] =
    useState("");

  // =========================================================
  // LOAD DATA
  // =========================================================

  async function loadData(
    customFrom = from,
    customTo = to,
    customId = customerId,
    customSearchDO = searchDO
  ) {
    try {
      setLoading(true);

      let id = customId;

      if (!id) {
        const resolvedParams = await params;

        id = resolvedParams.id;

        setCustomerId(id);
      }

      let url = `/api/laporan/customer/${id}`;

      const query: string[] = [];

      if (customFrom) {
        query.push(
          `from=${encodeURIComponent(customFrom)}`
        );
      }

      if (customTo) {
        query.push(
          `to=${encodeURIComponent(customTo)}`
        );
      }

      if (customSearchDO.trim()) {
        query.push(
          `searchDO=${encodeURIComponent(
            customSearchDO.trim()
          )}`
        );
      }

      if (query.length > 0) {
        url += "?" + query.join("&");
      }

      console.log("CALL API =", url);

      const res = await fetch(url, {
        cache: "no-store",
      });

      const json = await res.json();

      console.log(
        "DETAIL CUSTOMER RESPONSE =",
        json
      );

      if (json.success) {
        setCustomer(
          json.data?.customer ??
            json.customer ??
            null
        );

        setDeliveries(
          json.data?.deliveries ??
            json.deliveries ??
            []
        );
      } else {
        setCustomer(null);
        setDeliveries([]);
      }
    } catch (error) {
      console.error(
        "DETAIL CUSTOMER ERROR:",
        error
      );

      setCustomer(null);
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    async function init() {
      const resolvedParams =
        await params;

      const id =
        resolvedParams.id;

      setCustomerId(id);

      await loadData(
        "",
        "",
        id,
        ""
      );
    }

    init();
  }, []);

  // =========================================================
  // SUMMARY
  // =========================================================

  const summary = useMemo(() => {
    const transactionIds =
      new Set<number>();

    let totalQty = 0;
    let grandTotal = 0;

    deliveries.forEach(
      (delivery: any) => {
        if (delivery?.id) {
          transactionIds.add(
            Number(delivery.id)
          );
        }

        if (
          Array.isArray(
            delivery?.items
          )
        ) {
          delivery.items.forEach(
            (item: any) => {
              const qty =
                Number(item.qty || 0);

              const price =
                Number(item.price || 0);

              const subtotal =
                Number(
                  item.subtotal ??
                    qty * price
                );

              totalQty += qty;
              grandTotal += subtotal;
            }
          );
        }
      }
    );

    return {
      totalDO: transactionIds.size,
      totalQty,
      grandTotal,
    };
  }, [deliveries]);

  // =========================================================
  // FORMAT
  // =========================================================

  function formatNumber(
    value: number
  ) {
    return new Intl.NumberFormat(
      "id-ID"
    ).format(
      Number(value || 0)
    );
  }

  function formatCurrency(
    value: number
  ) {
    return (
      "Rp " +
      formatNumber(value)
    );
  }

  function formatDate(
    value?: string | null
  ) {
    if (!value) return "-";

    return new Date(
      value
    ).toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  function formatLongDate(
    value?: string | null
  ) {
    if (!value) return "-";

    return new Date(
      value
    ).toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }
    );
  }

  // =========================================================
  // FILTER LABEL
  // =========================================================

  const filterLabel = useMemo(() => {
    if (from && to) {
      return `${formatDate(
        from
      )} — ${formatDate(to)}`;
    }

    if (from) {
      return `Mulai ${formatDate(
        from
      )}`;
    }

    if (to) {
      return `Sampai ${formatDate(
        to
      )}`;
    }

    return "Semua periode";
  }, [from, to]);

  const hasFilter =
    Boolean(from || to || searchDO);

  // =========================================================
  // FILTER
  // =========================================================

  function handleFilter() {
    if (
      from &&
      to &&
      new Date(from) > new Date(to)
    ) {
      alert(
        "Tanggal Dari tidak boleh lebih besar dari Sampai tanggal."
      );
      return;
    }

    loadData(
      from,
      to,
      customerId,
      searchDO
    );
  }

  function resetFilter() {
    setFrom("");
    setTo("");
    setSearchDO("");

    loadData(
      "",
      "",
      customerId,
      ""
    );
  }

  // =========================================================
  // EXPORT EXCEL
  // =========================================================

  const rows: any[][] = [];

  deliveries.forEach(
    (delivery: any) => {
      delivery.items?.forEach(
        (item: any) => {
          const qty =
            Number(item.qty || 0);

          const price =
            Number(item.price || 0);

          const subtotal =
            Number(
              item.subtotal ??
                qty * price
            );

          rows.push([
            delivery.id ?? "-",
            delivery.number ?? "-",
            formatDate(
              delivery.deliveryDate
            ),
            item.barang?.code ?? "-",
            item.barang?.name ?? "-",
            qty,
            "Rp " +
              formatNumber(price),
            "Rp " +
              formatNumber(subtotal),
          ]);
        }
      );
    }
  );

  const columns = [
    "ID DO",
    "No DO",
    "Tanggal",
    "Kode Barang",
    "Barang",
    "Qty",
    "Harga",
    "Total",
  ];

  // =========================================================
  // PREMIUM PDF
  // =========================================================

  function exportPremiumPDF() {
    if (!customer) return;

    const doc =
      new jsPDF(
        "p",
        "mm",
        "a4"
      );

    const pageWidth =
      doc.internal.pageSize.getWidth();

    const pageHeight =
      doc.internal.pageSize.getHeight();

    const margin = 14;

    // -------------------------------------------------------
    // COLORS
    // -------------------------------------------------------

    const dark = [
      31, 41, 55,
    ];

    const muted = [
      107, 114, 128,
    ];

    const green = [
      73, 127, 112,
    ];

    const lightGreen = [
      237, 245, 242,
    ];

    const border = [
      229, 231, 235,
    ];

    const white = [
      255, 255, 255,
    ];

    // -------------------------------------------------------
    // HEADER
    // -------------------------------------------------------

    doc.setFillColor(
      green[0],
      green[1],
      green[2]
    );

    doc.rect(
      0,
      0,
      pageWidth,
      10,
      "F"
    );

    doc.setTextColor(
      dark[0],
      dark[1],
      dark[2]
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(19);

    doc.text(
      "LAPORAN DETAIL CUSTOMER",
      margin,
      23
    );

    doc.setFontSize(9);

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setTextColor(
      muted[0],
      muted[1],
      muted[2]
    );

    doc.text(
      "Riwayat Delivery Order & Detail Penjualan",
      margin,
      29
    );

    // -------------------------------------------------------
    // REPORT META
    // -------------------------------------------------------

    const generatedAt =
      new Date().toLocaleString(
        "id-ID",
        {
          dateStyle: "long",
          timeStyle: "short",
        }
      );

    doc.setFontSize(8);

    doc.text(
      `Dicetak: ${generatedAt}`,
      pageWidth - margin,
      23,
      {
        align: "right",
      }
    );

    doc.text(
      `Periode: ${filterLabel}`,
      pageWidth - margin,
      28,
      {
        align: "right",
      }
    );

    // -------------------------------------------------------
    // CUSTOMER CARD
    // -------------------------------------------------------

    let y = 38;

    doc.setFillColor(
      lightGreen[0],
      lightGreen[1],
      lightGreen[2]
    );

    doc.roundedRect(
      margin,
      y,
      pageWidth -
        margin * 2,
      31,
      4,
      4,
      "F"
    );

    doc.setTextColor(
      dark[0],
      dark[1],
      dark[2]
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(13);

    doc.text(
      customer.name || "-",
      margin + 6,
      y + 9
    );

    doc.setFontSize(8);

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setTextColor(
      muted[0],
      muted[1],
      muted[2]
    );

    const customerCode =
      customer.code
        ? `Kode: ${customer.code}`
        : "Kode customer: -";

    doc.text(
      customerCode,
      margin + 6,
      y + 15
    );

    doc.text(
      `Kota: ${customer.city || "-"}`,
      margin + 6,
      y + 20
    );

    doc.text(
      `Telepon: ${customer.phone || "-"}`,
      margin + 6,
      y + 25
    );

    doc.text(
      `Email: ${customer.email || "-"}`,
      pageWidth / 2 + 4,
      y + 15
    );

    doc.text(
      `Alamat: ${customer.address || "-"}`,
      pageWidth / 2 + 4,
      y + 20,
      {
        maxWidth:
          pageWidth / 2 -
          margin -
          8,
      }
    );

    y += 39;

    // -------------------------------------------------------
    // SUMMARY CARDS
    // -------------------------------------------------------

    const gap = 4;

    const cardWidth =
      (pageWidth -
        margin * 2 -
        gap * 2) /
      3;

    const cardHeight = 24;

    const summaryCards = [
      {
        label: "TOTAL DELIVERY ORDER",
        value: formatNumber(
          summary.totalDO
        ),
      },
      {
        label: "TOTAL QTY",
        value: formatNumber(
          summary.totalQty
        ),
      },
      {
        label: "TOTAL NILAI PENJUALAN",
        value: formatCurrency(
          summary.grandTotal
        ),
      },
    ];

    summaryCards.forEach(
      (card, index) => {
        const x =
          margin +
          index *
            (cardWidth + gap);

        doc.setDrawColor(
          border[0],
          border[1],
          border[2]
        );

        doc.setFillColor(
          white[0],
          white[1],
          white[2]
        );

        doc.roundedRect(
          x,
          y,
          cardWidth,
          cardHeight,
          3,
          3,
          "FD"
        );

        doc.setTextColor(
          muted[0],
          muted[1],
          muted[2]
        );

        doc.setFontSize(7);

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.text(
          card.label,
          x + 4,
          y + 7
        );

        doc.setTextColor(
          dark[0],
          dark[1],
          dark[2]
        );

        doc.setFontSize(
          index === 2
            ? 10
            : 13
        );

        doc.text(
          card.value,
          x + 4,
          y + 17
        );
      }
    );

    y += 33;

    // -------------------------------------------------------
    // FILTER INFORMATION
    // -------------------------------------------------------

    doc.setFillColor(
      248,
      250,
      252
    );

    doc.roundedRect(
      margin,
      y,
      pageWidth -
        margin * 2,
      13,
      3,
      3,
      "F"
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(8);

    doc.setTextColor(
      dark[0],
      dark[1],
      dark[2]
    );

    doc.text(
      "FILTER LAPORAN",
      margin + 4,
      y + 5
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setTextColor(
      muted[0],
      muted[1],
      muted[2]
    );

    doc.text(
      `Periode: ${filterLabel}`,
      margin + 4,
      y + 10
    );

    if (searchDO.trim()) {
      doc.text(
        `Nomor DO: ${searchDO.trim()}`,
        pageWidth -
          margin -
          4,
        y + 10,
        {
          align: "right",
        }
      );
    }

    y += 20;

    // -------------------------------------------------------
    // TABLE DATA
    // -------------------------------------------------------

    const tableBody: any[] = [];

    deliveries.forEach(
      (delivery: any) => {
        if (
          !Array.isArray(
            delivery.items
          )
        ) {
          return;
        }

        delivery.items.forEach(
          (item: any) => {
            const qty =
              Number(
                item.qty || 0
              );

            const price =
              Number(
                item.price || 0
              );

            const subtotal =
              Number(
                item.subtotal ??
                  qty * price
              );

            tableBody.push([
              delivery.number ||
                "-",

              formatDate(
                delivery.deliveryDate
              ),

              item.barang?.code ||
                "-",

              item.barang?.name ||
                "-",

              formatNumber(qty),

              formatCurrency(price),

              formatCurrency(
                subtotal
              ),
            ]);
          }
        );
      }
    );

    autoTable(doc, {
      startY: y,

      head: [[
        "No DO",
        "Tanggal",
        "Kode",
        "Barang",
        "Qty",
        "Harga",
        "Subtotal",
      ]],

      body:
        tableBody.length > 0
          ? tableBody
          : [[
              "-",
              "-",
              "-",
              "Tidak ada transaksi",
              "-",
              "-",
              "-",
            ]],

      margin: {
        left: margin,
        right: margin,
      },

      theme: "grid",

      styles: {
        font: "helvetica",
        fontSize: 7.5,
        cellPadding: 3,
        lineColor: border,
        lineWidth: 0.2,
        textColor: dark,
        valign: "middle",
      },

      headStyles: {
        fillColor: green,
        textColor: white,
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
      },

      alternateRowStyles: {
        fillColor: [
          249,
          250,
          251,
        ],
      },

      columnStyles: {
        0: {
          cellWidth: 31,
          fontStyle: "bold",
        },

        1: {
          cellWidth: 23,
          halign: "center",
        },

        2: {
          cellWidth: 21,
        },

        3: {
          cellWidth: "auto",
        },

        4: {
          cellWidth: 17,
          halign: "right",
        },

        5: {
          cellWidth: 27,
          halign: "right",
        },

        6: {
          cellWidth: 30,
          halign: "right",
          fontStyle: "bold",
        },
      },

      didDrawPage: (
        data
      ) => {
        // ---------------------------------------------------
        // FOOTER
        // ---------------------------------------------------

        const pageNumber =
          doc.getNumberOfPages();

        doc.setDrawColor(
          border[0],
          border[1],
          border[2]
        );

        doc.line(
          margin,
          pageHeight - 14,
          pageWidth - margin,
          pageHeight - 14
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(7);

        doc.setTextColor(
          muted[0],
          muted[1],
          muted[2]
        );

        doc.text(
          "MGB ERP • Laporan Customer",
          margin,
          pageHeight - 8
        );

        doc.text(
          `Halaman ${pageNumber}`,
          pageWidth - margin,
          pageHeight - 8,
          {
            align: "right",
          }
        );
      },
    });

    // -------------------------------------------------------
    // FINAL SAVE
    // -------------------------------------------------------

    const safeName =
      customer.name
        .replace(
          /[^a-zA-Z0-9-_]+/g,
          "-"
        )
        .replace(
          /^-+|-+$/g,
          ""
        );

    let fileName =
      `Laporan-Customer-${safeName || "Customer"}`;

    if (from || to) {
      fileName +=
        `-${from || "awal"}-${to || "akhir"}`;
    }

    if (searchDO.trim()) {
      fileName +=
        `-${searchDO.trim()}`;
    }

    fileName += ".pdf";

    doc.save(fileName);
  }

  // =========================================================
  // PRINT
  // =========================================================

  function handlePrint() {
    window.print();
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8F7] p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-[500px] items-center justify-center rounded-3xl border border-gray-100 bg-white shadow-sm">
            <div className="flex flex-col items-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDF5F2]">
                <RefreshCw
                  size={25}
                  className="animate-spin text-[#497F70]"
                />
              </div>

              <p className="font-semibold text-gray-800">
                Memuat detail customer
              </p>

              <p className="mt-1 text-sm text-gray-400">
                Mohon tunggu sebentar...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // NOT FOUND
  // =========================================================

  if (!customer) {
    return (
      <div className="min-h-screen bg-[#F6F8F7] p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-[450px] flex-col items-center justify-center rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-sm">

            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
              <Users size={28} />
            </div>

            <h1 className="text-xl font-bold text-gray-800">
              Customer tidak ditemukan
            </h1>

            <p className="mt-2 max-w-md text-sm text-gray-500">
              Data customer yang Anda cari
              tidak tersedia atau sudah tidak
              dapat diakses.
            </p>

            <Link
              href="/laporan/customer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3d6c5f]"
            >
              <ArrowLeft size={16} />
              Kembali ke Laporan Customer
            </Link>

          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="min-h-screen bg-[#F6F8F7] p-4 md:p-6 lg:p-8">

      <div className="mx-auto max-w-7xl">

        {/* ===================================================
            TOP HEADER
        =================================================== */}

        <div className="mb-6">

          <Link
            href="/laporan/customer"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#497F70] transition hover:text-[#3d6c5f]"
          >
            <ArrowLeft size={16} />
            Kembali ke Laporan Customer
          </Link>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-center gap-4">

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#497F70] text-white shadow-md shadow-[#497F70]/20">
                <Users size={26} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">

                  <h1 className="text-2xl font-bold tracking-tight text-[#1F2937] md:text-3xl">
                    {customer.name}
                  </h1>

                  {customer.code && (
                    <span className="rounded-full bg-[#EDF5F2] px-2.5 py-1 text-xs font-semibold text-[#497F70]">
                      {customer.code}
                    </span>
                  )}

                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">

                  {customer.city && (
                    <>
                      <MapPin size={14} />
                      <span>
                        {customer.city}
                      </span>
                    </>
                  )}

                  <span className="text-gray-300">
                    •
                  </span>

                  <span>
                    {summary.totalDO} Delivery Order
                  </span>

                </div>
              </div>

            </div>

            <button
              onClick={() =>
                loadData(
                  from,
                  to,
                  customerId,
                  searchDO
                )
              }
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
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

        {/* ===================================================
            CUSTOMER PROFILE
        =================================================== */}

        <div className="mb-6 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">

          <div className="border-b border-gray-100 px-5 py-4 md:px-6">

            <div className="flex items-center justify-between">

              <div>
                <h2 className="font-bold text-gray-900">
                  Informasi Customer
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Informasi dasar dan kontak customer
                </p>
              </div>

              <div className="hidden h-9 w-9 items-center justify-center rounded-xl bg-[#EDF5F2] text-[#497F70] sm:flex">
                <Users size={17} />
              </div>

            </div>

          </div>

          <div className="grid grid-cols-1 gap-px bg-gray-100 sm:grid-cols-2 xl:grid-cols-4">

            <div className="bg-white p-5">

              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <Users size={14} />
                Customer
              </div>

              <p className="font-semibold text-gray-800">
                {customer.name}
              </p>

            </div>

            <div className="bg-white p-5">

              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <MapPin size={14} />
                Kota
              </div>

              <p className="font-semibold text-gray-800">
                {customer.city || "-"}
              </p>

            </div>

            <div className="bg-white p-5">

              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <Phone size={14} />
                Telepon
              </div>

              <p className="font-semibold text-gray-800">
                {customer.phone || "-"}
              </p>

            </div>

            <div className="bg-white p-5">

              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <Mail size={14} />
                Email
              </div>

              <p className="break-all font-semibold text-gray-800">
                {customer.email || "-"}
              </p>

            </div>

          </div>

          {customer.address && (
            <div className="border-t border-gray-100 px-5 py-4 md:px-6">

              <div className="flex items-start gap-3">

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                  <MapPin size={15} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Alamat
                  </p>

                  <p className="mt-1 text-sm font-medium text-gray-700">
                    {customer.address}
                  </p>
                </div>

              </div>

            </div>
          )}

        </div>

        {/* ===================================================
            SUMMARY
        =================================================== */}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">

            <div className="flex items-start justify-between">

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Total Delivery Order
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                  {formatNumber(
                    summary.totalDO
                  )}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Transaksi customer
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ShoppingCart size={20} />
              </div>

            </div>

          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">

            <div className="flex items-start justify-between">

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Total Qty
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                  {formatNumber(
                    summary.totalQty
                  )}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Total quantity barang
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Package size={20} />
              </div>

            </div>

          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">

            <div className="flex items-start justify-between">

              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Total Nilai Penjualan
                </p>

                <p className="mt-2 truncate text-2xl font-bold tracking-tight text-gray-900">
                  {formatCurrency(
                    summary.grandTotal
                  )}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Total transaksi customer
                </p>
              </div>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EDF5F2] text-[#497F70]">
                <Wallet size={20} />
              </div>

            </div>

          </div>

        </div>

        {/* ===================================================
            FILTER
        =================================================== */}

        <div className="mb-6 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">

          <div className="border-b border-gray-100 px-5 py-4 md:px-6">

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

              <div>

                <h2 className="font-bold text-gray-900">
                  Filter Laporan
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Gunakan periode atau nomor DO untuk menyaring transaksi
                </p>

              </div>

              {hasFilter && (
                <button
                  onClick={resetFilter}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#497F70] hover:underline"
                >
                  <RotateCcw size={14} />
                  Reset Filter
                </button>
              )}

            </div>

          </div>

          <div className="p-5 md:p-6">

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">

              {/* SEARCH DO */}

              <div className="lg:col-span-1">

                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">
                  Nomor Delivery Order
                </label>

                <div className="relative">

                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="text"
                    value={searchDO}
                    onChange={(e) =>
                      setSearchDO(
                        e.target.value
                      )
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter"
                      ) {
                        handleFilter();
                      }
                    }}
                    placeholder="Cari nomor DO..."
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  />

                </div>

              </div>

              {/* FROM */}

              <div>

                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">
                  Dari Tanggal
                </label>

                <div className="relative">

                  <CalendarDays
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="date"
                    value={from}
                    onChange={(e) =>
                      setFrom(
                        e.target.value
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  />

                </div>

              </div>

              {/* TO */}

              <div>

                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">
                  Sampai Tanggal
                </label>

                <div className="relative">

                  <CalendarDays
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="date"
                    value={to}
                    onChange={(e) =>
                      setTo(
                        e.target.value
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  />

                </div>

              </div>

              {/* FILTER BUTTON */}

              <div className="flex items-end">

                <button
                  onClick={handleFilter}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#497F70] px-5 py-3 text-sm font-bold text-white shadow-sm shadow-[#497F70]/20 transition hover:bg-[#3d6c5f]"
                >
                  <Search size={16} />
                  Terapkan Filter
                </button>

              </div>

            </div>

            {/* ACTIVE FILTER */}

            <div className="mt-5 flex flex-wrap items-center gap-2">

              <span className="text-xs font-semibold text-gray-400">
                Periode aktif:
              </span>

              <span className="rounded-full bg-[#EDF5F2] px-3 py-1.5 text-xs font-bold text-[#497F70]">
                {filterLabel}
              </span>

              {searchDO && (
                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600">
                  DO: {searchDO}
                </span>
              )}

            </div>

            {/* EXPORT */}

            <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-5">

              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-900"
              >
                <Printer size={16} />
                Print
              </button>

              <button
                onClick={() =>
                  exportReportExcel(
                    `Detail Customer - ${customer.name}`,
                    columns,
                    rows
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <FileSpreadsheet size={16} />
                Excel
              </button>

              <button
                onClick={exportPremiumPDF}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                <FileDown size={16} />
                Export PDF
              </button>

            </div>

          </div>

        </div>

        {/* ===================================================
            TRANSACTION LIST
        =================================================== */}

        <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">

          <div className="border-b border-gray-100 px-5 py-5 md:px-6">

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDF5F2] text-[#497F70]">
                    <FileText size={17} />
                  </div>

                  <h2 className="font-bold text-gray-900">
                    Riwayat Delivery Order
                  </h2>

                </div>

                <p className="mt-2 text-xs text-gray-500">
                  Riwayat transaksi dan detail barang customer
                </p>

              </div>

              <div className="rounded-xl bg-gray-50 px-4 py-2 text-sm text-gray-500">
                Menampilkan{" "}
                <span className="font-bold text-gray-900">
                  {deliveries.length}
                </span>{" "}
                Delivery Order
              </div>

            </div>

          </div>

          {deliveries.length === 0 ? (

            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">

              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                <FileText size={24} />
              </div>

              <p className="font-semibold text-gray-700">
                Tidak ada transaksi
              </p>

              <p className="mt-1 max-w-md text-xs text-gray-400">
                Tidak ditemukan Delivery Order pada periode atau pencarian yang dipilih.
              </p>

            </div>

          ) : (

            <div className="divide-y divide-gray-100">

              {deliveries.map(
                (delivery: any) => {

                  const deliveryTotal =
                    delivery.items?.reduce(
                      (
                        total: number,
                        item: any
                      ) => {
                        const qty =
                          Number(
                            item.qty || 0
                          );

                        const price =
                          Number(
                            item.price || 0
                          );

                        return (
                          total +
                          Number(
                            item.subtotal ??
                              qty * price
                          )
                        );
                      },
                      0
                    ) || 0;

                  return (
                    <div
                      key={`delivery-${delivery.id}`}
                      className="p-5 md:p-6"
                    >

                      <div className="overflow-hidden rounded-2xl border border-gray-200">

                        {/* DO HEADER */}

                        <div className="bg-gradient-to-r from-[#EDF5F2] to-white px-5 py-5">

                          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                            <div>

                              <div className="mb-2 flex items-center gap-2">

                                <span className="rounded-lg bg-[#497F70] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                                  DELIVERY ORDER
                                </span>

                                <span className="text-xs text-gray-400">
                                  #{delivery.id}
                                </span>

                              </div>

                              <h3 className="text-lg font-bold text-gray-900">
                                {delivery.number || "-"}
                              </h3>

                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">

                                <span className="inline-flex items-center gap-1.5">
                                  <CalendarDays size={13} />
                                  {formatLongDate(
                                    delivery.deliveryDate
                                  )}
                                </span>

                                <span className="text-gray-300">
                                  •
                                </span>

                                <span>
                                  {delivery.items?.length || 0} item
                                </span>

                              </div>

                            </div>

                            <div className="lg:text-right">

                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                Total DO
                              </p>

                              <p className="mt-1 text-xl font-bold text-gray-900">
                                {formatCurrency(
                                  deliveryTotal
                                )}
                              </p>

                            </div>

                          </div>

                        </div>

                        {/* ITEMS */}

                        <div className="overflow-x-auto">

                          <table className="min-w-full text-sm">

                            <thead>
                              <tr className="border-t border-gray-200 bg-gray-50">

                                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                                  Barang
                                </th>

                                <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500">
                                  Qty
                                </th>

                                <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                                  Harga
                                </th>

                                <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                                  Subtotal
                                </th>

                              </tr>
                            </thead>

                            <tbody>

                              {Array.isArray(
                                delivery.items
                              ) &&
                              delivery.items.length > 0 ? (

                                delivery.items.map(
                                  (
                                    item: any
                                  ) => {

                                    const qty =
                                      Number(
                                        item.qty || 0
                                      );

                                    const price =
                                      Number(
                                        item.price || 0
                                      );

                                    const subtotal =
                                      Number(
                                        item.subtotal ??
                                          qty * price
                                      );

                                    return (
                                      <tr
                                        key={`delivery-${delivery.id}-item-${item.id}`}
                                        className="border-t border-gray-100 transition hover:bg-gray-50"
                                      >

                                        <td className="px-5 py-4">

                                          <div className="flex items-center gap-3">

                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                                              <Package size={16} />
                                            </div>

                                            <div>
                                              <p className="font-semibold text-gray-800">
                                                {item.barang?.name ||
                                                  "-"}
                                              </p>

                                              {item.barang?.code && (
                                                <p className="mt-0.5 text-[11px] text-gray-400">
                                                  {item.barang.code}
                                                </p>
                                              )}
                                            </div>

                                          </div>

                                        </td>

                                        <td className="px-5 py-4 text-center">

                                          <span className="inline-flex min-w-[50px] justify-center rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
                                            {formatNumber(
                                              qty
                                            )}
                                          </span>

                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4 text-right text-gray-600">
                                          {formatCurrency(
                                            price
                                          )}
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-gray-900">
                                          {formatCurrency(
                                            subtotal
                                          )}
                                        </td>

                                      </tr>
                                    );
                                  }
                                )

                              ) : (

                                <tr>
                                  <td
                                    colSpan={4}
                                    className="px-5 py-8 text-center text-sm text-gray-400"
                                  >
                                    Tidak ada detail barang.
                                  </td>
                                </tr>

                              )}

                            </tbody>

                          </table>

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          )}

        </div>

      </div>
    </div>
  );
}