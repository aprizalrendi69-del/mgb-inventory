"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  RefreshCw,
  Search,
  CalendarDays,
  ShoppingCart,
  Building2,
  Download,
  Filter,
  RotateCcw,
  TrendingUp,
  WalletCards,
  ChevronDown,
  CheckCircle2,
  Clock3,
  XCircle,
  PackageCheck,
  ReceiptText,
  Sparkles,
} from "lucide-react";

type Supplier = {
  id: number;
  code?: string;
  name: string;
};

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type Purchase = {
  id: number;
  number: string;
  purchaseDate?: string;
  status?: string;
  total?: number;
  supplier?: Supplier;
  outlet?: Outlet;
  items?: any[];
};

export default function LaporanPurchaseOutletPage() {
  const [data, setData] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [outletId, setOutletId] = useState("");

  const [tanggalAwal, setTanggalAwal] = useState("");
  const [tanggalAkhir, setTanggalAkhir] = useState("");

  /*
   * =====================================================
   * USER ROLE
   * =====================================================
   */

  const [userRole, setUserRole] = useState<string | null>(null);
  const [userOutlet, setUserOutlet] = useState<Outlet | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  /*
   * =====================================================
   * CURRENT USER
   * =====================================================
   */

  async function loadCurrentUser() {
    try {
      setLoadingUser(true);

      const res = await fetch("/api/me", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json?.message || "Gagal mengambil data user"
        );
      }

      const user =
        json?.user ??
        json?.data ??
        json;

      setUserRole(
        user?.role
          ? String(user.role).toUpperCase()
          : null
      );

      setUserOutlet(
        user?.outlet
          ? {
              id: Number(user.outlet.id),
              code: user.outlet.code,
              name: user.outlet.name,
            }
          : null
      );
    } catch (error) {
      console.error(
        "LOAD CURRENT USER ERROR:",
        error
      );

      setUserRole(null);
      setUserOutlet(null);
    } finally {
      setLoadingUser(false);
    }
  }

  /*
   * =====================================================
   * LOAD PURCHASE
   * =====================================================
   */

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch(
        "/api/outlet/purchase",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error(
          "LOAD PURCHASE OUTLET ERROR:",
          json
        );

        setData([]);
        return;
      }

      const result = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
        ? json.data
        : [];

      setData(result);
    } catch (error) {
      console.error(
        "LOAD LAPORAN PURCHASE OUTLET ERROR:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  /*
   * =====================================================
   * INITIAL LOAD
   * =====================================================
   */

  useEffect(() => {
    loadCurrentUser();
    loadData();
  }, []);

  /*
   * =====================================================
   * ROLE
   * =====================================================
   */

  const isOutletAdmin =
    userRole === "OUTLET_ADMIN";

  const isAdminPusat =
    userRole === "ADMIN" ||
    userRole === "PURCHASING";

  /*
   * =====================================================
   * OUTLET LIST
   * =====================================================
   */

  const outletList = useMemo(() => {
    const map = new Map<number, Outlet>();

    for (const item of data) {
      if (!item.outlet) continue;

      const id = Number(item.outlet.id);

      if (!map.has(id)) {
        map.set(id, {
          id,
          code: item.outlet.code,
          name: item.outlet.name,
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        a.name.localeCompare(
          b.name,
          "id"
        )
    );
  }, [data]);

  /*
   * =====================================================
   * FILTER DATA
   * =====================================================
   */

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const keyword =
        search
          .toLowerCase()
          .trim();

      const text = `
        ${item.number ?? ""}
        ${item.supplier?.code ?? ""}
        ${item.supplier?.name ?? ""}
        ${item.outlet?.code ?? ""}
        ${item.outlet?.name ?? ""}
      `.toLowerCase();

      if (
        keyword &&
        !text.includes(keyword)
      ) {
        return false;
      }

      if (
        status &&
        String(item.status ?? "")
          .toUpperCase() !==
          status.toUpperCase()
      ) {
        return false;
      }

      if (isOutletAdmin) {
        if (
          !userOutlet ||
          Number(item.outlet?.id) !==
            Number(userOutlet.id)
        ) {
          return false;
        }
      } else if (
        outletId &&
        Number(item.outlet?.id) !==
          Number(outletId)
      ) {
        return false;
      }

      if (
        tanggalAwal ||
        tanggalAkhir
      ) {
        if (!item.purchaseDate) {
          return false;
        }

        const tanggal =
          new Date(
            item.purchaseDate
          );

        if (
          Number.isNaN(
            tanggal.getTime()
          )
        ) {
          return false;
        }

        if (tanggalAwal) {
          const awal =
            new Date(
              `${tanggalAwal}T00:00:00`
            );

          if (tanggal < awal) {
            return false;
          }
        }

        if (tanggalAkhir) {
          const akhir =
            new Date(
              `${tanggalAkhir}T23:59:59`
            );

          if (tanggal > akhir) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    data,
    search,
    status,
    outletId,
    tanggalAwal,
    tanggalAkhir,
    isOutletAdmin,
    userOutlet,
  ]);

  /*
   * =====================================================
   * SUMMARY
   * =====================================================
   */

  const totalPO =
    filteredData.length;

  const totalNominal =
    filteredData.reduce(
      (total, item) =>
        total +
        Number(item.total ?? 0),
      0
    );

  const totalApproved =
    filteredData.filter(
      (item) =>
        String(item.status ?? "")
          .toUpperCase() ===
        "APPROVED"
    ).length;

  const totalReceived =
    filteredData.filter(
      (item) =>
        String(item.status ?? "")
          .toUpperCase() ===
        "RECEIVED"
    ).length;

  /*
   * =====================================================
   * FORMAT NUMBER
   * =====================================================
   */

  function formatNumber(
    value: any
  ) {
    return Number(
      value ?? 0
    ).toLocaleString("id-ID");
  }

  /*
   * =====================================================
   * FORMAT RUPIAH
   * =====================================================
   */

  function formatRupiah(
    value: any
  ) {
    return `Rp ${formatNumber(
      value
    )}`;
  }

  /*
   * =====================================================
   * FORMAT DATE
   * =====================================================
   */

  function formatDate(
    value?: string
  ) {
    if (!value) {
      return "-";
    }

    const date =
      new Date(value);

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

  /*
   * =====================================================
   * STATUS
   * =====================================================
   */

  function getStatusConfig(
    value?: string
  ) {
    const currentStatus =
      String(
        value ?? "DRAFT"
      ).toUpperCase();

    if (
      currentStatus ===
      "APPROVED"
    ) {
      return {
        label: "APPROVED",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        dot:
          "bg-emerald-500",
        icon:
          <CheckCircle2 size={13} />,
      };
    }

    if (
      currentStatus ===
      "RECEIVED"
    ) {
      return {
        label: "RECEIVED",
        className:
          "border-blue-200 bg-blue-50 text-blue-700",
        dot:
          "bg-blue-500",
        icon:
          <PackageCheck size={13} />,
      };
    }

    if (
      currentStatus ===
      "CANCELLED"
    ) {
      return {
        label: "CANCELLED",
        className:
          "border-red-200 bg-red-50 text-red-700",
        dot:
          "bg-red-500",
        icon:
          <XCircle size={13} />,
      };
    }

    if (
      currentStatus ===
      "REJECTED"
    ) {
      return {
        label: "REJECTED",
        className:
          "border-red-200 bg-red-50 text-red-700",
        dot:
          "bg-red-500",
        icon:
          <XCircle size={13} />,
      };
    }

    return {
      label: currentStatus,
      className:
        "border-amber-200 bg-amber-50 text-amber-700",
      dot:
        "bg-amber-500",
      icon:
        <Clock3 size={13} />,
    };
  }

  /*
   * =====================================================
   * RESET
   * =====================================================
   */

  function resetFilter() {
    setSearch("");
    setStatus("");
    setTanggalAwal("");
    setTanggalAkhir("");

    if (!isOutletAdmin) {
      setOutletId("");
    }
  }

  /*
   * =====================================================
   * PDF
   * =====================================================
   */

  async function downloadPDF() {
    if (
      loadingPdf ||
      filteredData.length === 0
    ) {
      return;
    }

    try {
      setLoadingPdf(true);

      const jsPDFModule =
        await import("jspdf");

      const autoTableModule =
        await import(
          "jspdf-autotable"
        );

      const JsPDF =
        jsPDFModule.default;

      const doc =
        new JsPDF({
          orientation: "landscape",
          unit: "mm",
          format: "a4",
        });

      const autoTable =
        autoTableModule.default;

      const pageWidth =
        doc.internal.pageSize
          .getWidth();

      /*
       * HEADER
       */

      doc.setFillColor(
        24,
        53,
        45
      );

      doc.rect(
        0,
        0,
        pageWidth,
        34,
        "F"
      );

      doc.setTextColor(
        255,
        255,
        255
      );

      doc.setFontSize(18);
      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.text(
        "MGB INVENTORY",
        15,
        13
      );

      doc.setFontSize(9);
      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.text(
        "PT. MITRA GARAM BOGATAMA",
        15,
        20
      );

      doc.setFontSize(12);
      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.text(
        "LAPORAN PURCHASE ORDER OUTLET",
        pageWidth - 15,
        14,
        {
          align: "right",
        }
      );

      doc.setFontSize(8);
      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.text(
        `Dicetak: ${new Date().toLocaleString(
          "id-ID"
        )}`,
        pageWidth - 15,
        21,
        {
          align: "right",
        }
      );

      /*
       * FILTER INFO
       */

      let filterY = 43;

      doc.setTextColor(
        24,
        53,
        45
      );

      doc.setFontSize(9);
      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.text(
        "FILTER LAPORAN",
        15,
        filterY
      );

      filterY += 6;

      doc.setFont(
        "helvetica",
        "normal"
      );

      const outletLabel =
        isOutletAdmin
          ? userOutlet
            ? `${userOutlet.code} - ${userOutlet.name}`
            : "-"
          : outletId
          ? outletList.find(
              (x) =>
                String(x.id) ===
                String(outletId)
            )?.name ?? "-"
          : "Semua Outlet";

      const periode =
        tanggalAwal ||
        tanggalAkhir
          ? `${tanggalAwal || "..."} s/d ${
              tanggalAkhir || "..."
            }`
          : "Semua Periode";

      doc.text(
        `Outlet: ${outletLabel}`,
        15,
        filterY
      );

      doc.text(
        `Periode: ${periode}`,
        95,
        filterY
      );

      doc.text(
        `Status: ${
          status || "Semua Status"
        }`,
        190,
        filterY
      );

      /*
       * SUMMARY BOX
       */

      filterY += 8;

      doc.setFillColor(
        245,
        248,
        246
      );

      doc.roundedRect(
        15,
        filterY,
        pageWidth - 30,
        16,
        2,
        2,
        "F"
      );

      doc.setFontSize(8);

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setTextColor(
        73,
        127,
        112
      );

      doc.text(
        "TOTAL PO",
        20,
        filterY + 6
      );

      doc.setTextColor(
        24,
        53,
        45
      );

      doc.setFontSize(11);

      doc.text(
        formatNumber(totalPO),
        20,
        filterY + 12
      );

      doc.setFontSize(8);

      doc.setTextColor(
        73,
        127,
        112
      );

      doc.text(
        "TOTAL NILAI",
        80,
        filterY + 6
      );

      doc.setTextColor(
        24,
        53,
        45
      );

      doc.setFontSize(11);

      doc.text(
        formatRupiah(totalNominal),
        80,
        filterY + 12
      );

      doc.setFontSize(8);

      doc.setTextColor(
        73,
        127,
        112
      );

      doc.text(
        "APPROVED",
        185,
        filterY + 6
      );

      doc.setTextColor(
        24,
        53,
        45
      );

      doc.setFontSize(11);

      doc.text(
        formatNumber(totalApproved),
        185,
        filterY + 12
      );

      doc.setFontSize(8);

      doc.setTextColor(
        73,
        127,
        112
      );

      doc.text(
        "RECEIVED",
        240,
        filterY + 6
      );

      doc.setTextColor(
        24,
        53,
        45
      );

      doc.setFontSize(11);

      doc.text(
        formatNumber(totalReceived),
        240,
        filterY + 12
      );

      /*
       * TABLE
       */

      const rows =
        filteredData.map(
          (item, index) => [
            index + 1,
            item.number || "-",
            formatDate(
              item.purchaseDate
            ),
            item.supplier?.code
              ? `${item.supplier.code} - ${item.supplier.name}`
              : item.supplier?.name ||
                "-",
            item.outlet?.code
              ? `${item.outlet.code} - ${item.outlet.name}`
              : item.outlet?.name ||
                "-",
            String(
              item.status ||
                "DRAFT"
            ).toUpperCase(),
            formatRupiah(
              item.total
            ),
          ]
        );

      autoTable(
        doc,
        {
          startY: filterY + 23,
          head: [
            [
              "No",
              "Nomor PO",
              "Tanggal",
              "Supplier",
              "Outlet",
              "Status",
              "Total",
            ],
          ],
          body: rows,
          theme: "grid",
          styles: {
            font:
              "helvetica",
            fontSize: 8,
            cellPadding: 3,
            textColor: [
              45,
              55,
              50,
            ],
            lineColor: [
              220,
              230,
              225,
            ],
            lineWidth: 0.2,
          },
          headStyles: {
            fillColor: [
              24,
              53,
              45,
            ],
            textColor: [
              255,
              255,
              255,
            ],
            fontStyle:
              "bold",
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
              cellWidth: 12,
              halign: "center",
            },
            1: {
              cellWidth: 32,
            },
            2: {
              cellWidth: 25,
            },
            3: {
              cellWidth: 62,
            },
            4: {
              cellWidth: 55,
            },
            5: {
              cellWidth: 28,
              halign: "center",
            },
            6: {
              cellWidth: 40,
              halign: "right",
            },
          },
          didParseCell:
            (hookData: any) => {
              if (
                hookData.section ===
                  "body" &&
                hookData.column.index ===
                  5
              ) {
                const value =
                  String(
                    hookData.cell.raw
                  ).toUpperCase();

                if (
                  value ===
                  "APPROVED"
                ) {
                  hookData.cell.styles.textColor =
                    [
                      22,
                      125,
                      88,
                    ];
                } else if (
                  value ===
                    "RECEIVED"
                ) {
                  hookData.cell.styles.textColor =
                    [
                      37,
                      99,
                      235,
                    ];
                } else if (
                  value ===
                    "CANCELLED" ||
                  value ===
                    "REJECTED"
                ) {
                  hookData.cell.styles.textColor =
                    [
                      220,
                      38,
                      38,
                    ];
                } else {
                  hookData.cell.styles.textColor =
                    [
                      180,
                      120,
                      0,
                    ];
                }

                hookData.cell.styles.fontStyle =
                  "bold";
              }
            },
        }
      );

      /*
       * FOOTER
       */

      const pageCount =
        doc.getNumberOfPages();

      for (
        let page = 1;
        page <= pageCount;
        page++
      ) {
        doc.setPage(page);

        const pageHeight =
          doc.internal.pageSize
            .getHeight();

        doc.setDrawColor(
          220,
          230,
          225
        );

        doc.line(
          15,
          pageHeight - 12,
          pageWidth - 15,
          pageHeight - 12
        );

        doc.setFontSize(7);
        doc.setTextColor(
          120,
          130,
          125
        );

        doc.text(
          "MGB Inventory & Distribution",
          15,
          pageHeight - 6
        );

        doc.text(
          `Halaman ${page} / ${pageCount}`,
          pageWidth - 15,
          pageHeight - 6,
          {
            align: "right",
          }
        );
      }

      const dateStamp =
        new Date()
          .toISOString()
          .slice(0, 10);

      doc.save(
        `Laporan-Purchase-Outlet-${dateStamp}.pdf`
      );
    } catch (error) {
      console.error(
        "DOWNLOAD PDF ERROR:",
        error
      );

      alert(
        "Gagal membuat PDF. Pastikan package jspdf dan jspdf-autotable sudah tersedia."
      );
    } finally {
      setLoadingPdf(false);
    }
  }

  /*
   * =====================================================
   * FILTER ACTIVE
   * =====================================================
   */

  const activeFilterCount =
    [
      search,
      status,
      outletId,
      tanggalAwal,
      tanggalAkhir,
    ].filter(Boolean).length;

  /*
   * =====================================================
   * RENDER
   * =====================================================
   */

  return (
    <div className="min-h-full bg-[#F4F7F5] p-4 md:p-6 lg:p-8">

      {/* ================================================= */}
      {/* PREMIUM HEADER */}
      {/* ================================================= */}

      <div className="relative mb-7 overflow-hidden rounded-[28px] bg-[#18352D] px-6 py-7 text-white shadow-[0_18px_45px_rgba(24,53,45,0.15)] md:px-8 md:py-8">

        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#497F70]/30 blur-3xl" />

        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#6EAA98]/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex items-start gap-4">

            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-inner backdrop-blur-md">
              <ReceiptText
                size={27}
                strokeWidth={1.8}
              />
            </div>

            <div>

              <div className="mb-1 flex items-center gap-2">

                <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">
                  Procurement Report
                </span>

                <Sparkles
                  size={13}
                  className="text-emerald-200"
                />

              </div>

              <h1 className="text-2xl font-bold tracking-tight md:text-[30px]">
                Laporan Purchase Order Outlet
              </h1>

              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-white/60">
                Monitoring Purchase Order outlet,
                supplier, status approval, hingga
                total nilai pembelian.
              </p>

            </div>

          </div>

          <div className="flex flex-wrap gap-3">

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
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
              onClick={downloadPDF}
              disabled={
                loadingPdf ||
                filteredData.length === 0
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-[#18352D] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#F4FAF7] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >

              {loadingPdf ? (
                <RefreshCw
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Download size={16} />
              )}

              {loadingPdf
                ? "Membuat PDF..."
                : "Download PDF"}

            </button>

          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* OUTLET ADMIN */}
      {/* ================================================= */}

      {isOutletAdmin &&
        userOutlet && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white shadow-sm">

            <div className="flex items-center gap-4 px-5 py-4">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <Building2 size={20} />
              </div>

              <div className="min-w-0">

                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-500">
                  Outlet Anda
                </p>

                <div className="mt-0.5 flex flex-wrap items-center gap-2">

                  <p className="truncate font-bold text-blue-900">
                    {userOutlet.name}
                  </p>

                  <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                    {userOutlet.code}
                  </span>

                </div>

              </div>

              <div className="ml-auto hidden items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 shadow-sm md:flex">

                <CheckCircle2
                  size={13}
                />

                Data Terproteksi

              </div>

            </div>

          </div>
        )}

      {/* ================================================= */}
      {/* SUMMARY */}
      {/* ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* TOTAL PO */}

        <div className="group relative overflow-hidden rounded-2xl border border-[#DDE8E3] bg-white p-5 shadow-[0_8px_30px_rgba(24,53,45,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(24,53,45,0.08)]">

          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#497F70]/5 transition group-hover:scale-125" />

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Total Purchase Order
              </p>

              <p className="mt-2 text-2xl font-black tracking-tight text-[#18352D]">
                {formatNumber(totalPO)}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Data sesuai filter aktif
              </p>

            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <ShoppingCart size={20} />
            </div>

          </div>

        </div>

        {/* TOTAL NOMINAL */}

        <div className="group relative overflow-hidden rounded-2xl border border-[#DDE8E3] bg-white p-5 shadow-[0_8px_30px_rgba(24,53,45,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(24,53,45,0.08)]">

          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/5 transition group-hover:scale-125" />

          <div className="relative flex items-start justify-between">

            <div className="min-w-0">

              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Total Nilai Purchase
              </p>

              <p className="mt-2 truncate text-xl font-black tracking-tight text-[#18352D]">
                {formatRupiah(totalNominal)}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Nilai seluruh PO terfilter
              </p>

            </div>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <WalletCards size={20} />
            </div>

          </div>

        </div>

        {/* APPROVED */}

        <div className="group relative overflow-hidden rounded-2xl border border-[#DDE8E3] bg-white p-5 shadow-[0_8px_30px_rgba(24,53,45,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(24,53,45,0.08)]">

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Approved
              </p>

              <p className="mt-2 text-2xl font-black tracking-tight text-emerald-700">
                {formatNumber(totalApproved)}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Purchase siap diproses
              </p>

            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={20} />
            </div>

          </div>

        </div>

        {/* RECEIVED */}

        <div className="group relative overflow-hidden rounded-2xl border border-[#DDE8E3] bg-white p-5 shadow-[0_8px_30px_rgba(24,53,45,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(24,53,45,0.08)]">

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Received
              </p>

              <p className="mt-2 text-2xl font-black tracking-tight text-blue-700">
                {formatNumber(totalReceived)}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Purchase telah diterima
              </p>

            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <PackageCheck size={20} />
            </div>

          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* FILTER */}
      {/* ================================================= */}

      <div className="mb-6 overflow-hidden rounded-2xl border border-[#DDE8E3] bg-white shadow-[0_8px_30px_rgba(24,53,45,0.04)]">

        <div className="border-b border-[#EDF2EF] px-5 py-4 md:px-6">

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <Filter size={18} />
              </div>

              <div>

                <div className="flex items-center gap-2">

                  <h2 className="font-bold text-[#18352D]">
                    Filter Laporan
                  </h2>

                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-[#18352D] px-2 py-0.5 text-[10px] font-bold text-white">
                      {activeFilterCount} aktif
                    </span>
                  )}

                </div>

                <p className="text-xs text-gray-400">
                  Gunakan filter untuk mempersempit data laporan
                </p>

              </div>

            </div>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilter}
                className="inline-flex items-center gap-2 self-start rounded-lg px-3 py-2 text-xs font-bold text-[#497F70] transition hover:bg-[#EAF3EF] md:self-auto"
              >
                <RotateCcw size={14} />
                Reset Filter
              </button>
            )}

          </div>

        </div>

        <div className="p-5 md:p-6">

          <div
            className={`grid grid-cols-1 gap-4 ${
              isAdminPusat
                ? "lg:grid-cols-6"
                : "lg:grid-cols-4"
            }`}
          >

            {/* SEARCH */}

            <div
              className={
                isAdminPusat
                  ? "lg:col-span-2"
                  : "lg:col-span-1"
              }
            >

              <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#35564C]">
                <Search size={13} />
                Cari Data
              </label>

              <div className="relative">

                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Nomor PO / supplier / outlet..."
                  className="h-11 w-full rounded-xl border border-[#D5E2DC] bg-[#F9FBFA] pl-10 pr-4 text-sm text-[#18352D] outline-none transition placeholder:text-gray-400 hover:border-[#BFD3C9] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                />

              </div>

            </div>

            {/* OUTLET */}

            {isAdminPusat && (
              <div>

                <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#35564C]">
                  <Building2 size={13} />
                  Outlet
                </label>

                <div className="relative">

                  <Building2
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <select
                    value={outletId}
                    onChange={(e) =>
                      setOutletId(
                        e.target.value
                      )
                    }
                    className="h-11 w-full appearance-none rounded-xl border border-[#D5E2DC] bg-[#F9FBFA] pl-10 pr-9 text-sm font-medium text-[#18352D] outline-none transition hover:border-[#BFD3C9] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  >

                    <option value="">
                      Semua Outlet
                    </option>

                    {outletList.map(
                      (outlet) => (
                        <option
                          key={outlet.id}
                          value={outlet.id}
                        >
                          {outlet.code} -{" "}
                          {outlet.name}
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

            {/* STATUS */}

            <div>

              <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#35564C]">
                <CheckCircle2 size={13} />
                Status
              </label>

              <div className="relative">

                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(
                      e.target.value
                    )
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-[#D5E2DC] bg-[#F9FBFA] px-4 pr-9 text-sm font-medium text-[#18352D] outline-none transition hover:border-[#BFD3C9] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                >

                  <option value="">
                    Semua Status
                  </option>

                  <option value="DRAFT">
                    DRAFT
                  </option>

                  <option value="APPROVED">
                    APPROVED
                  </option>

                  <option value="RECEIVED">
                    RECEIVED
                  </option>

                  <option value="CANCELLED">
                    CANCELLED
                  </option>

                  <option value="REJECTED">
                    REJECTED
                  </option>

                </select>

                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

              </div>

            </div>

            {/* FROM */}

            <div>

              <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#35564C]">
                <CalendarDays size={13} />
                Dari Tanggal
              </label>

              <div className="relative">

                <CalendarDays
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="date"
                  value={tanggalAwal}
                  onChange={(e) =>
                    setTanggalAwal(
                      e.target.value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-[#D5E2DC] bg-[#F9FBFA] pl-10 pr-3 text-sm font-medium text-[#18352D] outline-none transition hover:border-[#BFD3C9] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                />

              </div>

            </div>

            {/* TO */}

            <div>

              <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#35564C]">
                <CalendarDays size={13} />
                Sampai Tanggal
              </label>

              <div className="relative">

                <CalendarDays
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="date"
                  value={tanggalAkhir}
                  onChange={(e) =>
                    setTanggalAkhir(
                      e.target.value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-[#D5E2DC] bg-[#F9FBFA] pl-10 pr-3 text-sm font-medium text-[#18352D] outline-none transition hover:border-[#BFD3C9] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                />

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* TABLE */}
      {/* ================================================= */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE8E3] bg-white shadow-[0_8px_30px_rgba(24,53,45,0.04)]">

        {/* TABLE HEADER */}

        <div className="flex flex-col gap-4 border-b border-[#EDF2EF] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <FileText size={18} />
            </div>

            <div>

              <h2 className="font-bold text-[#18352D]">
                Data Purchase Order Outlet
              </h2>

              <div className="mt-0.5 flex items-center gap-2">

                <span className="text-xs text-gray-400">
                  {formatNumber(
                    filteredData.length
                  )}{" "}
                  data ditemukan
                </span>

                {activeFilterCount > 0 && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-gray-300" />

                    <span className="text-xs font-medium text-[#497F70]">
                      Filter aktif
                    </span>
                  </>
                )}

              </div>

            </div>

          </div>

          <button
            type="button"
            onClick={downloadPDF}
            disabled={
              loadingPdf ||
              filteredData.length === 0
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#CFE0D8] bg-[#F7FAF8] px-4 text-xs font-bold text-[#35564C] transition hover:border-[#497F70] hover:bg-[#EAF3EF] disabled:cursor-not-allowed disabled:opacity-40"
          >

            {loadingPdf ? (
              <RefreshCw
                size={15}
                className="animate-spin"
              />
            ) : (
              <Download size={15} />
            )}

            Export PDF

          </button>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="min-w-[1150px] w-full text-sm">

            <thead>

              <tr className="border-b border-[#E5ECE9] bg-[#F7F9F8]">

                <th className="w-16 px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-[#6B7F76]">
                  No
                </th>

                <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#6B7F76]">
                  Nomor PO
                </th>

                <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#6B7F76]">
                  Tanggal
                </th>

                <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#6B7F76]">
                  Supplier
                </th>

                <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#6B7F76]">
                  Outlet
                </th>

                <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-[#6B7F76]">
                  Status
                </th>

                <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#6B7F76]">
                  Total Purchase
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ||
              loadingUser ? (
                <tr>

                  <td
                    colSpan={7}
                    className="px-5 py-20 text-center"
                  >

                    <div className="mx-auto flex max-w-xs flex-col items-center">

                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70]">
                        <RefreshCw
                          size={21}
                          className="animate-spin"
                        />
                      </div>

                      <p className="font-semibold text-[#35564C]">
                        Memuat laporan
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Mengambil data Purchase Order...
                      </p>

                    </div>

                  </td>

                </tr>
              ) : filteredData.length === 0 ? (

                <tr>

                  <td
                    colSpan={7}
                    className="px-5 py-20 text-center"
                  >

                    <div className="mx-auto flex max-w-sm flex-col items-center">

                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F4F2] text-gray-300">
                        <FileText size={25} />
                      </div>

                      <p className="font-bold text-[#35564C]">
                        Tidak ada data Purchase Order
                      </p>

                      <p className="mt-1 text-xs leading-5 text-gray-400">
                        Belum ada Purchase Order yang
                        sesuai dengan filter yang dipilih.
                      </p>

                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={resetFilter}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#EAF3EF] px-3 py-2 text-xs font-bold text-[#497F70] transition hover:bg-[#DDEEE7]"
                        >
                          <RotateCcw size={13} />
                          Reset Filter
                        </button>
                      )}

                    </div>

                  </td>

                </tr>

              ) : (

                filteredData.map(
                  (item, index) => {
                    const statusConfig =
                      getStatusConfig(
                        item.status
                      );

                    return (
                      <tr
                        key={item.id}
                        className="group border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
                      >

                        {/* NO */}

                        <td className="px-5 py-4 text-center">

                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#F3F6F4] text-xs font-bold text-gray-500 group-hover:bg-[#EAF3EF] group-hover:text-[#497F70]">
                            {index + 1}
                          </span>

                        </td>

                        {/* NOMOR */}

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-3">

                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                              <FileText size={15} />
                            </div>

                            <div>

                              <div className="font-bold text-[#18352D]">
                                {item.number ||
                                  "-"}
                              </div>

                              <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                                Purchase Order
                              </div>

                            </div>

                          </div>

                        </td>

                        {/* TANGGAL */}

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-2 text-gray-600">

                            <CalendarDays
                              size={15}
                              className="text-gray-400"
                            />

                            <span className="font-medium">
                              {formatDate(
                                item.purchaseDate
                              )}
                            </span>

                          </div>

                        </td>

                        {/* SUPPLIER */}

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {item.supplier?.name ||
                              "-"}
                          </div>

                          {item.supplier?.code && (
                            <div className="mt-1 inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                              {item.supplier.code}
                            </div>
                          )}

                        </td>

                        {/* OUTLET */}

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-2">

                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F2F6F4] text-[#497F70]">
                              <Building2
                                size={14}
                              />
                            </div>

                            <div>

                              <div className="font-semibold text-[#18352D]">
                                {item.outlet?.name ||
                                  "-"}
                              </div>

                              {item.outlet?.code && (
                                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                  {item.outlet.code}
                                </div>
                              )}

                            </div>

                          </div>

                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-4 text-center">

                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-wide ${statusConfig.className}`}
                          >

                            <span
                              className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`}
                            />

                            {statusConfig.icon}

                            {statusConfig.label}

                          </span>

                        </td>

                        {/* TOTAL */}

                        <td className="px-5 py-4 text-right">

                          <div className="font-bold text-[#18352D]">
                            {formatRupiah(
                              item.total
                            )}
                          </div>

                          <div className="mt-1 text-[10px] text-gray-400">
                            Nilai Purchase
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

        {/* TABLE FOOTER */}

        {!loading &&
          !loadingUser &&
          filteredData.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-[#EDF2EF] bg-[#FBFCFB] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">

              <div className="flex items-center gap-2 text-xs text-gray-400">

                <TrendingUp
                  size={14}
                  className="text-[#497F70]"
                />

                Menampilkan{" "}
                <span className="font-bold text-[#35564C]">
                  {formatNumber(
                    filteredData.length
                  )}
                </span>{" "}
                Purchase Order

              </div>

              <div className="flex items-center gap-2">

                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Total
                </span>

                <span className="rounded-lg bg-[#EAF3EF] px-3 py-1.5 text-xs font-bold text-[#497F70]">
                  {formatRupiah(
                    totalNominal
                  )}
                </span>

              </div>

            </div>
          )}

      </div>

    </div>
  );
}