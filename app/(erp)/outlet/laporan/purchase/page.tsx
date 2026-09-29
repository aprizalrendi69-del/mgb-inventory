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
  ChevronUp,
  Package,
  MessageCircle,
  Copy,
  Layers3,
  CircleDollarSign,
  Users,
  ClipboardList,
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

type PurchaseItem = {
  id?: number | string;
  barangId?: number | string | null;
  code?: string | null;
  kode?: string | null;
  name?: string | null;
  nama?: string | null;
  qty?: number | string | null;
  quantity?: number | string | null;
  jumlah?: number | string | null;
  unit?: string | null;
  satuan?: string | null;
  price?: number | string | null;
  harga?: number | string | null;
  unitPrice?: number | string | null;
  total?: number | string | null;
  subtotal?: number | string | null;
  amount?: number | string | null;
  barang?: {
    id?: number | string;
    code?: string | null;
    kode?: string | null;
    name?: string | null;
    nama?: string | null;
    unit?: string | null;
    satuan?: string | null;
  } | null;
  product?: {
    code?: string | null;
    name?: string | null;
  } | null;
};

type Purchase = {
  id: number;
  number: string;
  purchaseDate?: string;
  status?: string;
  total?: number;
  supplier?: Supplier;
  outlet?: Outlet;
  items?: PurchaseItem[];
};

const WA_GREEN = "#25D366";

export default function LaporanPurchaseOutletPage() {
  const [data, setData] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [outletId, setOutletId] = useState("");
  const [tanggalAwal, setTanggalAwal] = useState("");
  const [tanggalAkhir, setTanggalAkhir] = useState("");

  const [userRole, setUserRole] = useState<string | null>(null);
  const [userOutlet, setUserOutlet] = useState<Outlet | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [expandedIds, setExpandedIds] = useState<Set<number>>(
    new Set(),
  );

  const [copied, setCopied] = useState(false);

  async function loadCurrentUser() {
    try {
      setLoadingUser(true);

      const res = await fetch("/api/me", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json?.message || "Gagal mengambil data user",
        );
      }

      const user = json?.user ?? json?.data ?? json;

      setUserRole(
        user?.role
          ? String(user.role).toUpperCase()
          : null,
      );

      setUserOutlet(
        user?.outlet
          ? {
              id: Number(user.outlet.id),
              code: user.outlet.code,
              name: user.outlet.name,
            }
          : null,
      );
    } catch (error) {
      console.error(
        "LOAD CURRENT USER ERROR:",
        error,
      );

      setUserRole(null);
      setUserOutlet(null);
    } finally {
      setLoadingUser(false);
    }
  }

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch(
        "/api/outlet/purchase",
        {
          cache: "no-store",
        },
      );

      const json = await res.json();

      if (!res.ok) {
        console.error(
          "LOAD PURCHASE OUTLET ERROR:",
          json,
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
        error,
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCurrentUser();
    loadData();
  }, []);

  const isOutletAdmin =
    userRole === "OUTLET_ADMIN";

  const isAdminPusat =
    userRole === "ADMIN" ||
    userRole === "PURCHASING";

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
          "id",
        ),
    );
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const keyword =
        search.toLowerCase().trim();

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
        String(item.status ?? "").toUpperCase() !==
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

        const tanggal = new Date(
          item.purchaseDate,
        );

        if (
          Number.isNaN(
            tanggal.getTime(),
          )
        ) {
          return false;
        }

        if (
          tanggalAwal &&
          tanggal <
            new Date(
              `${tanggalAwal}T00:00:00`,
            )
        ) {
          return false;
        }

        if (
          tanggalAkhir &&
          tanggal >
            new Date(
              `${tanggalAkhir}T23:59:59`,
            )
        ) {
          return false;
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

  const totalPO =
    filteredData.length;

  const totalNominal =
    filteredData.reduce(
      (total, item) =>
        total +
        Number(item.total ?? 0),
      0,
    );

  const totalApproved =
    filteredData.filter(
      (item) =>
        String(
          item.status ?? "",
        ).toUpperCase() ===
        "APPROVED",
    ).length;

  const totalReceived =
    filteredData.filter(
      (item) =>
        String(
          item.status ?? "",
        ).toUpperCase() ===
        "RECEIVED",
    ).length;

  const totalDraft =
    filteredData.filter(
      (item) =>
        String(
          item.status ?? "",
        ).toUpperCase() ===
        "DRAFT",
    ).length;

  const totalCancelled =
    filteredData.filter((item) =>
      [
        "CANCELLED",
        "REJECTED",
      ].includes(
        String(
          item.status ?? "",
        ).toUpperCase(),
      ),
    ).length;

  function formatNumber(
    value: unknown,
  ) {
    return Number(
      value ?? 0,
    ).toLocaleString(
      "id-ID",
    );
  }

  function formatRupiah(
    value: unknown,
  ) {
    return `Rp ${formatNumber(
      value,
    )}`;
  }

  function formatDate(
    value?: string,
  ) {
    if (!value) return "-";

    const date = new Date(
      value,
    );

    if (
      Number.isNaN(
        date.getTime(),
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
      },
    );
  }

  function formatDateLong(
    value?: string,
  ) {
    if (!value) return "-";

    const date = new Date(
      value,
    );

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return "-";
    }

    return date.toLocaleDateString(
      "id-ID",
      {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      },
    );
  }

  function numeric(
    ...values: unknown[]
  ) {
    for (const value of values) {
      if (
        value !== null &&
        value !== undefined &&
        value !== ""
      ) {
        const n = Number(value);

        if (
          Number.isFinite(n)
        ) {
          return n;
        }
      }
    }

    return 0;
  }

  function getItemCode(
    item: PurchaseItem,
  ) {
    return (
      item.code ||
      item.kode ||
      item.barang?.code ||
      item.barang?.kode ||
      item.product?.code ||
      (item.barangId
        ? String(item.barangId)
        : "-")
    );
  }

  function getItemName(
    item: PurchaseItem,
  ) {
    return (
      item.name ||
      item.nama ||
      item.barang?.name ||
      item.barang?.nama ||
      item.product?.name ||
      "Barang"
    );
  }

  function getItemQty(
    item: PurchaseItem,
  ) {
    return numeric(
      item.qty,
      item.quantity,
      item.jumlah,
    );
  }

  function getItemUnit(
    item: PurchaseItem,
  ) {
    return (
      item.unit ||
      item.satuan ||
      item.barang?.unit ||
      item.barang?.satuan ||
      ""
    );
  }

  function getItemPrice(
    item: PurchaseItem,
  ) {
    return numeric(
      item.price,
      item.harga,
      item.unitPrice,
    );
  }

  function getItemTotal(
    item: PurchaseItem,
  ) {
    const explicit =
      numeric(
        item.total,
        item.subtotal,
        item.amount,
      );

    if (explicit !== 0) {
      return explicit;
    }

    return (
      getItemQty(item) *
      getItemPrice(item)
    );
  }

  function getItems(
    item: Purchase,
  ) {
    return Array.isArray(
      item.items,
    )
      ? item.items
      : [];
  }

  function getPurchaseQty(
    item: Purchase,
  ) {
    return getItems(item).reduce(
      (sum, detail) =>
        sum +
        getItemQty(detail),
      0,
    );
  }

  function getStatusConfig(
    value?: string,
  ) {
    const currentStatus =
      String(
        value ?? "DRAFT",
      ).toUpperCase();

    if (
      currentStatus ===
      "APPROVED"
    ) {
      return {
        label: "APPROVED",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        dot: "bg-emerald-500",
        icon: (
          <CheckCircle2
            size={13}
          />
        ),
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
        dot: "bg-blue-500",
        icon: (
          <PackageCheck
            size={13}
          />
        ),
      };
    }

    if (
      currentStatus ===
        "CANCELLED" ||
      currentStatus ===
        "REJECTED"
    ) {
      return {
        label: currentStatus,
        className:
          "border-red-200 bg-red-50 text-red-700",
        dot: "bg-red-500",
        icon: (
          <XCircle
            size={13}
          />
        ),
      };
    }

    return {
      label: currentStatus,
      className:
        "border-amber-200 bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
      icon: (
        <Clock3
          size={13}
        />
      ),
    };
  }

  function resetFilter() {
    setSearch("");
    setStatus("");
    setTanggalAwal("");
    setTanggalAkhir("");

    if (!isOutletAdmin) {
      setOutletId("");
    }
  }

  function toggleExpanded(
    id: number,
  ) {
    setExpandedIds(
      (current) => {
        const next =
          new Set(current);

        if (
          next.has(id)
        ) {
          next.delete(id);
        } else {
          next.add(id);
        }

        return next;
      },
    );
  }

  function getWhatsAppPeriod() {
    if (
      tanggalAwal &&
      tanggalAkhir
    ) {
      return `${tanggalAwal} s/d ${tanggalAkhir}`;
    }

    if (tanggalAwal) {
      return `Mulai ${tanggalAwal}`;
    }

    if (tanggalAkhir) {
      return `Sampai ${tanggalAkhir}`;
    }

    return "Semua Periode";
  }

  function getWhatsAppStatusSummary() {
    const parts: string[] =
      [];

    if (
      totalDraft > 0
    ) {
      parts.push(
        `DRAFT ${totalDraft}`,
      );
    }

    if (
      totalApproved > 0
    ) {
      parts.push(
        `APPROVED ${totalApproved}`,
      );
    }

    if (
      totalReceived > 0
    ) {
      parts.push(
        `RECEIVED ${totalReceived}`,
      );
    }

    if (
      totalCancelled > 0
    ) {
      parts.push(
        `CANCELLED/REJECTED ${totalCancelled}`,
      );
    }

    return parts.length
      ? parts.join("  •  ")
      : "-";
  }

  /**
   * =========================================================
   * WHATSAPP MESSAGE
   * =========================================================
   *
   * Format:
   *
   * ━━━━━━━━━━━━━━━━━━━━
   * 📋 *PURCHASE ORDER OUTLET*
   * 🏢 *MGB INVENTORY & DISTRIBUTION*
   * ━━━━━━━━━━━━━━━━━━━━
   *
   * ────────────────────
   * *Nama Supplier*
   * ────────────────────
   * _*No.PO*_ : *OP-00088*
   *
   * • *Daun Wansui* : 0,2 kg *(Price - Rp 53.000)*
   * • *Selada Keriting* : 5 kg *(Price - Rp 15.000)*
   *
   * 💰 Subtotal  : *Rp 85.600*
   *
   * ────────────────────
   * *Supplier Berikutnya*
   * ────────────────────
   */
  function buildWhatsAppMessage() {
    const lines: string[] =
      [];

    const totalFilteredQty =
      filteredData.reduce(
        (sum, po) =>
          sum +
          getPurchaseQty(po),
        0,
      );

    lines.push(
      "━━━━━━━━━━━━━━━━━━━━",
    );
    lines.push(
      "📋 *PURCHASE ORDER OUTLET*",
    );
    lines.push(
      "🏢 *MGB INVENTORY & DISTRIBUTION*",
    );
    lines.push(
      "━━━━━━━━━━━━━━━━━━━━",
    );
    lines.push("");

    /**
     * Group berdasarkan supplier.
     * Supplier yang sama hanya dibuatkan
     * satu header.
     */
    const supplierGroups =
      new Map<
        string,
        Purchase[]
      >();

    for (const po of filteredData) {
      const supplierName =
        po.supplier?.name?.trim() ||
        "Supplier Tidak Diketahui";

      const existing =
        supplierGroups.get(
          supplierName,
        ) ?? [];

      existing.push(po);

      supplierGroups.set(
        supplierName,
        existing,
      );
    }

    for (const [
      supplierName,
      purchases,
    ] of supplierGroups) {
      lines.push(
        "────────────────────",
      );

      lines.push(
        `*${supplierName}*`,
      );

      lines.push(
        "────────────────────",
      );

      purchases.forEach(
        (po) => {
          const items =
            getItems(po);

          lines.push(
            `_*No.PO*_ → *${po.number || "-"}*`,
          );

          lines.push("");

          if (
            items.length > 0
          ) {
            items.forEach(
              (item) => {
                const itemName =
                  getItemName(
                    item,
                  );

                const qty =
                  formatNumber(
                    getItemQty(
                      item,
                    ),
                  );

                const unit =
                  getItemUnit(
                    item,
                  );

                const price =
                  formatRupiah(
                    getItemPrice(
                      item,
                    ),
                  );

                const qtyText =
                  unit
                    ? `${qty} ${unit}`
                    : qty;

                lines.push(
                  `• *${itemName}* : ${qtyText} _*(Price - ${price})*_`,
                );
              },
            );
          } else {
            lines.push(
              "• Belum ada detail item",
            );
          }

          lines.push("");

          lines.push(
            `💰 Subtotal  : *${formatRupiah(po.total)}*`,
          );

          lines.push("");
        },
      );
    }

    lines.push(
      "━━━━━━━━━━━━━━━━━━━━",
    );

    lines.push(
      "💼 *TOTAL LAPORAN*",
    );

    lines.push(
      `• Total Purchase Order : *${formatNumber(
        totalPO,
      )}*`,
    );

    lines.push(
      `• Total Qty            : *${formatNumber(
        totalFilteredQty,
      )}*`,
    );

    lines.push(
      `• Total Nilai          : *${formatRupiah(
        totalNominal,
      )}*`,
    );

    lines.push("");

    lines.push(
      `📊 Status: ${getWhatsAppStatusSummary()}`,
    );

    lines.push("");

    lines.push(
      `🕒 Dibuat: ${new Date().toLocaleString(
        "id-ID",
        {
          hour12: false,
        },
      )}`,
    );

    lines.push("");

    lines.push(
      "Terima kasih 🙏🏻",
    );

    return lines.join("\n");
  }

  function openWhatsApp() {
    if (
      !filteredData.length
    ) {
      return;
    }

    const message =
      buildWhatsAppMessage();

    const whatsappWebUrl =
      `https://web.whatsapp.com/send?text=${encodeURIComponent(
        message,
      )}`;

    window.open(
      whatsappWebUrl,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function copyWhatsAppMessage() {
    if (
      !filteredData.length
    ) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        buildWhatsAppMessage(),
      );

      setCopied(true);

      window.setTimeout(
        () => {
          setCopied(false);
        },
        2200,
      );
    } catch (error) {
      console.error(
        "COPY WHATSAPP MESSAGE ERROR:",
        error,
      );

      alert(
        "Gagal menyalin pesan WhatsApp. Silakan coba kembali.",
      );
    }
  }

  async function downloadPDF() {
    if (
      loadingPdf ||
      filteredData.length ===
        0
    ) {
      return;
    }

    try {
      setLoadingPdf(true);

      const jsPDFModule =
        await import(
          "jspdf"
        );

      const autoTableModule =
        await import(
          "jspdf-autotable"
        );

      const JsPDF =
        jsPDFModule.default;

      const autoTable =
        autoTableModule.default;

      const doc =
        new JsPDF({
          orientation:
            "landscape",
          unit: "mm",
          format: "a4",
        });

      const pageWidth =
        doc.internal.pageSize.getWidth();

      doc.setFillColor(
        24,
        53,
        45,
      );

      doc.rect(
        0,
        0,
        pageWidth,
        34,
        "F",
      );

      doc.setTextColor(
        255,
        255,
        255,
      );

      doc.setFontSize(
        18,
      );

      doc.setFont(
        "helvetica",
        "bold",
      );

      doc.text(
        "MGB INVENTORY",
        15,
        13,
      );

      doc.setFontSize(
        9,
      );

      doc.setFont(
        "helvetica",
        "normal",
      );

      doc.text(
        "PT. MITRA GARAM BOGATAMA",
        15,
        20,
      );

      doc.setFontSize(
        12,
      );

      doc.setFont(
        "helvetica",
        "bold",
      );

      doc.text(
        "LAPORAN PURCHASE ORDER OUTLET",
        pageWidth - 15,
        14,
        {
          align: "right",
        },
      );

      doc.setFontSize(
        8,
      );

      doc.setFont(
        "helvetica",
        "normal",
      );

      doc.text(
        `Dicetak: ${new Date().toLocaleString(
          "id-ID",
        )}`,
        pageWidth - 15,
        21,
        {
          align: "right",
        },
      );

      let filterY = 43;

      doc.setTextColor(
        24,
        53,
        45,
      );

      doc.setFontSize(
        9,
      );

      doc.setFont(
        "helvetica",
        "bold",
      );

      doc.text(
        "FILTER LAPORAN",
        15,
        filterY,
      );

      filterY += 6;

      doc.setFont(
        "helvetica",
        "normal",
      );

      const outletLabel =
        isOutletAdmin
          ? userOutlet
            ? `${userOutlet.code} - ${userOutlet.name}`
            : "-"
          : outletId
            ? (
                outletList.find(
                  (x) =>
                    String(
                      x.id,
                    ) ===
                    String(
                      outletId,
                    ),
                )?.name ?? "-"
              )
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
        filterY,
      );

      doc.text(
        `Periode: ${periode}`,
        95,
        filterY,
      );

      doc.text(
        `Status: ${
          status ||
          "Semua Status"
        }`,
        190,
        filterY,
      );

      filterY += 8;

      doc.setFillColor(
        245,
        248,
        246,
      );

      doc.roundedRect(
        15,
        filterY,
        pageWidth - 30,
        16,
        2,
        2,
        "F",
      );

      const summary = [
        [
          "TOTAL PO",
          formatNumber(
            totalPO,
          ),
          "TOTAL NILAI",
          formatRupiah(
            totalNominal,
          ),
          "APPROVED",
          formatNumber(
            totalApproved,
          ),
          "RECEIVED",
          formatNumber(
            totalReceived,
          ),
        ],
      ];

      autoTable(doc, {
        startY:
          filterY + 1,
        body: summary,
        theme: "plain",
        styles: {
          fontSize: 8,
          cellPadding: 2,
          font: "helvetica",
        },
      });

      const rows =
        filteredData.map(
          (
            item,
            index,
          ) => [
            index + 1,
            item.number || "-",
            formatDate(
              item.purchaseDate,
            ),
            item.supplier
              ?.code
              ? `${item.supplier.code} - ${item.supplier.name}`
              : item.supplier
                  ?.name ||
                "-",
            item.outlet
              ?.code
              ? `${item.outlet.code} - ${item.outlet.name}`
              : item.outlet
                  ?.name ||
                "-",
            String(
              item.status ||
                "DRAFT",
            ).toUpperCase(),
            formatRupiah(
              item.total,
            ),
          ],
        );

      autoTable(doc, {
        startY:
          filterY + 23,
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
          font: "helvetica",
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
        alternateRowStyles:
          {
            fillColor: [
              249,
              251,
              250,
            ],
          },
        columnStyles: {
          0: {
            cellWidth: 12,
            halign:
              "center",
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
            halign:
              "center",
          },
          6: {
            cellWidth: 40,
            halign:
              "right",
          },
        },
      });

      const pageCount =
        doc.getNumberOfPages();

      for (
        let page = 1;
        page <= pageCount;
        page++
      ) {
        doc.setPage(
          page,
        );

        const pageHeight =
          doc.internal.pageSize.getHeight();

        doc.setDrawColor(
          220,
          230,
          225,
        );

        doc.line(
          15,
          pageHeight - 12,
          pageWidth - 15,
          pageHeight - 12,
        );

        doc.setFontSize(
          7,
        );

        doc.setTextColor(
          120,
          130,
          125,
        );

        doc.text(
          "MGB Inventory & Distribution",
          15,
          pageHeight - 6,
        );

        doc.text(
          `Halaman ${page} / ${pageCount}`,
          pageWidth - 15,
          pageHeight - 6,
          {
            align: "right",
          },
        );
      }

      doc.save(
        `Laporan-Purchase-Outlet-${new Date()
          .toISOString()
          .slice(
            0,
            10,
          )}.pdf`,
      );
    } catch (error) {
      console.error(
        "DOWNLOAD PDF ERROR:",
        error,
      );

      alert(
        "Gagal membuat PDF. Pastikan package jspdf dan jspdf-autotable sudah tersedia.",
      );
    } finally {
      setLoadingPdf(false);
    }
  }

  const activeFilterCount =
    [
      search,
      status,
      outletId,
      tanggalAwal,
      tanggalAkhir,
    ].filter(Boolean).length;

  const totalFilteredQty =
    filteredData.reduce(
      (sum, item) =>
        sum +
        getPurchaseQty(item),
      0,
    );

  return (
    <div className="min-h-screen bg-[#F5F8F6] px-4 py-5 md:px-6 lg:px-8">
      {/* =========================================================
          HERO
      ========================================================= */}
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-[#18352D] px-6 py-7 text-white shadow-[0_15px_45px_rgba(24,53,45,0.14)] md:px-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-emerald-300/5 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-inner backdrop-blur-md">
              <ReceiptText
                size={27}
                strokeWidth={1.8}
              />
            </div>

            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
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
                Monitoring Purchase Order
                outlet, supplier, item barang,
                status approval, hingga total
                nilai pembelian.
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
              onClick={openWhatsApp}
              disabled={
                !filteredData.length
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#20BD5B] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MessageCircle
                size={17}
              />
              WhatsApp Web

              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
                {filteredData.length}{" "}
                PO
              </span>
            </button>

            <button
              type="button"
              onClick={downloadPDF}
              disabled={
                loadingPdf ||
                !filteredData.length
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-[#18352D] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#F4FAF7] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingPdf ? (
                <RefreshCw
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Download
                  size={16}
                />
              )}

              {loadingPdf
                ? "Membuat PDF..."
                : "Download PDF"}
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================
          OUTLET ADMIN NOTICE
      ========================================================= */}
      {isOutletAdmin &&
        userOutlet && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white shadow-sm">
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <Building2
                  size={20}
                />
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

      {/* =========================================================
          KPI
      ========================================================= */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label:
              "Total Purchase Order",
            value:
              formatNumber(
                totalPO,
              ),
            note: "Data sesuai filter aktif",
            icon: (
              <ShoppingCart
                size={20}
              />
            ),
            box: "bg-[#EAF3EF] text-[#497F70]",
          },
          {
            label:
              "Total Nilai Purchase",
            value:
              formatRupiah(
                totalNominal,
              ),
            note: "Nilai seluruh PO terfilter",
            icon: (
              <WalletCards
                size={20}
              />
            ),
            box: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "Approved",
            value:
              formatNumber(
                totalApproved,
              ),
            note: "Purchase siap diproses",
            icon: (
              <CheckCircle2
                size={20}
              />
            ),
            box: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "Received",
            value:
              formatNumber(
                totalReceived,
              ),
            note: "Purchase telah diterima",
            icon: (
              <PackageCheck
                size={20}
              />
            ),
            box: "bg-blue-50 text-blue-600",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="group relative overflow-hidden rounded-2xl border border-[#DDE8E3] bg-white p-5 shadow-[0_8px_30px_rgba(24,53,45,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(24,53,45,0.08)]"
          >
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  {card.label}
                </p>

                <p className="mt-2 truncate text-2xl font-black tracking-tight text-[#18352D]">
                  {card.value}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  {card.note}
                </p>
              </div>

              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.box}`}
              >
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* =========================================================
          FILTER
      ========================================================= */}
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

                  {activeFilterCount >
                    0 && (
                    <span className="rounded-full bg-[#18352D] px-2 py-0.5 text-[10px] font-bold text-white">
                      {activeFilterCount}{" "}
                      aktif
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-400">
                  Gunakan filter untuk
                  mempersempit data laporan
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
                className="inline-flex items-center gap-2 self-start rounded-lg px-3 py-2 text-xs font-bold text-[#497F70] transition hover:bg-[#EAF3EF] md:self-auto"
              >
                <RotateCcw
                  size={14}
                />
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
                      e.target.value,
                    )
                  }
                  placeholder="Nomor PO / supplier / outlet..."
                  className="h-11 w-full rounded-xl border border-[#D5E2DC] bg-[#F9FBFA] pl-10 pr-4 text-sm text-[#18352D] outline-none transition placeholder:text-gray-400 hover:border-[#BFD3C9] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                />
              </div>
            </div>

            {isAdminPusat && (
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#35564C]">
                  <Building2
                    size={13}
                  />
                  Outlet
                </label>

                <div className="relative">
                  <Building2
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <select
                    value={
                      outletId
                    }
                    onChange={(e) =>
                      setOutletId(
                        e.target
                          .value,
                      )
                    }
                    className="h-11 w-full appearance-none rounded-xl border border-[#D5E2DC] bg-[#F9FBFA] pl-10 pr-9 text-sm font-medium text-[#18352D] outline-none transition hover:border-[#BFD3C9] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                  >
                    <option value="">
                      Semua Outlet
                    </option>

                    {outletList.map(
                      (
                        outlet,
                      ) => (
                        <option
                          key={
                            outlet.id
                          }
                          value={
                            outlet.id
                          }
                        >
                          {
                            outlet.code
                          }{" "}
                          -{" "}
                          {
                            outlet.name
                          }
                        </option>
                      ),
                    )}
                  </select>

                  <ChevronDown
                    size={15}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#35564C]">
                <CheckCircle2
                  size={13}
                />
                Status
              </label>

              <div className="relative">
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(
                      e.target.value,
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

            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#35564C]">
                <CalendarDays
                  size={13}
                />
                Dari Tanggal
              </label>

              <div className="relative">
                <CalendarDays
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="date"
                  value={
                    tanggalAwal
                  }
                  onChange={(e) =>
                    setTanggalAwal(
                      e.target
                        .value,
                    )
                  }
                  className="h-11 w-full rounded-xl border border-[#D5E2DC] bg-[#F9FBFA] pl-10 pr-3 text-sm font-medium text-[#18352D] outline-none transition hover:border-[#BFD3C9] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#35564C]">
                <CalendarDays
                  size={13}
                />
                Sampai Tanggal
              </label>

              <div className="relative">
                <CalendarDays
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="date"
                  value={
                    tanggalAkhir
                  }
                  onChange={(e) =>
                    setTanggalAkhir(
                      e.target
                        .value,
                    )
                  }
                  className="h-11 w-full rounded-xl border border-[#D5E2DC] bg-[#F9FBFA] pl-10 pr-3 text-sm font-medium text-[#18352D] outline-none transition hover:border-[#BFD3C9] focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          DATA TABLE
      ========================================================= */}
      <div className="overflow-hidden rounded-2xl border border-[#DDE8E3] bg-white shadow-[0_8px_30px_rgba(24,53,45,0.04)]">
        <div className="flex flex-col gap-4 border-b border-[#EDF2EF] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <FileText
                size={18}
              />
            </div>

            <div>
              <h2 className="font-bold text-[#18352D]">
                Data Purchase Order Outlet
              </h2>

              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400">
                  {formatNumber(
                    filteredData.length,
                  )}{" "}
                  data ditemukan
                </span>

                <span className="h-1 w-1 rounded-full bg-gray-300" />

                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#497F70]">
                  <Layers3
                    size={12}
                  />
                  {formatNumber(
                    totalFilteredQty,
                  )}{" "}
                  total qty
                </span>

                {activeFilterCount >
                  0 && (
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

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={
                copyWhatsAppMessage
              }
              disabled={
                !filteredData.length
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#CFE0D8] bg-[#F7FAF8] px-4 text-xs font-bold text-[#35564C] transition hover:border-[#497F70] hover:bg-[#EAF3EF] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Copy size={15} />

              {copied
                ? "Pesan Tersalin ✓"
                : "Salin Pesan"}
            </button>

            <button
              type="button"
              onClick={
                openWhatsApp
              }
              disabled={
                !filteredData.length
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#20BD5B] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MessageCircle
                size={15}
              />

              WhatsApp Web

              {filteredData.length >
                0 && (
                <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px]">
                  {
                    filteredData.length
                  }
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={
                downloadPDF
              }
              disabled={
                loadingPdf ||
                !filteredData.length
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#CFE0D8] bg-[#F7FAF8] px-4 text-xs font-bold text-[#35564C] transition hover:border-[#497F70] hover:bg-[#EAF3EF] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loadingPdf ? (
                <RefreshCw
                  size={15}
                  className="animate-spin"
                />
              ) : (
                <Download
                  size={15}
                />
              )}

              Export PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5ECE9] bg-[#F7F9F8]">
                <th className="w-16 px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-[#6B7F76]">
                  No
                </th>

                <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#6B7F76]">
                  Dokumen Transaksi
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
                  Subtotal
                </th>

                <th className="px-5 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-[#6B7F76]">
                  Detail
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ||
              loadingUser ? (
                <tr>
                  <td
                    colSpan={8}
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
                        Mengambil data
                        Purchase
                        Order...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-20 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F4F2] text-gray-300">
                        <FileText
                          size={25}
                        />
                      </div>

                      <p className="font-bold text-[#35564C]">
                        Tidak ada data
                        Purchase
                        Order
                      </p>

                      <p className="mt-1 text-xs leading-5 text-gray-400">
                        Belum ada
                        Purchase
                        Order yang
                        sesuai
                        dengan
                        filter
                        yang
                        dipilih.
                      </p>

                      {activeFilterCount >
                        0 && (
                        <button
                          type="button"
                          onClick={
                            resetFilter
                          }
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#EAF3EF] px-3 py-2 text-xs font-bold text-[#497F70] transition hover:bg-[#DDEEE7]"
                        >
                          <RotateCcw
                            size={
                              13
                            }
                          />
                          Reset
                          Filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map(
                  (
                    item,
                    index,
                  ) => {
                    const statusConfig =
                      getStatusConfig(
                        item.status,
                      );

                    const items =
                      getItems(
                        item,
                      );

                    const expanded =
                      expandedIds.has(
                        item.id,
                      );

                    const itemQty =
                      getPurchaseQty(
                        item,
                      );

                    return (
                      <FragmentRow
                        key={
                          item.id
                        }
                        item={
                          item
                        }
                        index={
                          index
                        }
                        statusConfig={
                          statusConfig
                        }
                        items={
                          items
                        }
                        expanded={
                          expanded
                        }
                        itemQty={
                          itemQty
                        }
                        onToggle={() =>
                          toggleExpanded(
                            item.id,
                          )
                        }
                        formatNumber={
                          formatNumber
                        }
                        formatRupiah={
                          formatRupiah
                        }
                        formatDate={
                          formatDate
                        }
                        getItemCode={
                          getItemCode
                        }
                        getItemName={
                          getItemName
                        }
                        getItemQty={
                          getItemQty
                        }
                        getItemUnit={
                          getItemUnit
                        }
                        getItemPrice={
                          getItemPrice
                        }
                        getItemTotal={
                          getItemTotal
                        }
                      />
                    );
                  },
                )
              )}
            </tbody>
          </table>
        </div>

        {!loading &&
          !loadingUser &&
          filteredData.length >
            0 && (
            <div className="flex flex-col gap-3 border-t border-[#EDF2EF] bg-[#FBFCFB] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                <span className="inline-flex items-center gap-2">
                  <TrendingUp
                    size={14}
                    className="text-[#497F70]"
                  />

                  Menampilkan{" "}
                  <strong className="text-[#35564C]">
                    {formatNumber(
                      filteredData.length,
                    )}
                  </strong>{" "}
                  Purchase
                  Order
                </span>

                <span className="hidden h-1 w-1 rounded-full bg-gray-300 md:block" />

                <span className="inline-flex items-center gap-1.5">
                  <Package
                    size={13}
                    className="text-[#497F70]"
                  />

                  Total Qty{" "}
                  <strong className="text-[#35564C]">
                    {formatNumber(
                      totalFilteredQty,
                    )}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Total Nilai
                </span>

                <span className="rounded-lg bg-[#EAF3EF] px-3 py-1.5 text-xs font-bold text-[#497F70]">
                  {formatRupiah(
                    totalNominal,
                  )}
                </span>
              </div>
            </div>
          )}
      </div>

      {/* =========================================================
          WHATSAPP PREMIUM PANEL
      ========================================================= */}
      <div className="relative mt-5 overflow-hidden rounded-2xl border border-[#CFE7D8] bg-gradient-to-br from-white via-[#F8FCF9] to-[#EDF9F1] px-5 py-5 shadow-[0_10px_35px_rgba(37,211,102,0.06)]">
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#25D366]/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#20BD5B]">
              <MessageCircle
                size={20}
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-[#18352D]">
                  Laporan WhatsApp Premium
                </p>

                <span className="rounded-full bg-[#25D366]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#20BD5B]">
                  WhatsApp Web
                </span>
              </div>

              <p className="mt-1 max-w-2xl text-[11px] leading-5 text-gray-500">
                Pesan otomatis mengikuti
                filter aktif dengan format
                supplier, nomor PO, item,
                qty, harga, subtotal, dan
                total laporan.
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDE8E3] bg-white px-2.5 py-1 text-[10px] font-semibold text-gray-500">
                  <ClipboardList
                    size={12}
                    className="text-[#497F70]"
                  />

                  {formatNumber(
                    filteredData.length,
                  )}{" "}
                  PO
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDE8E3] bg-white px-2.5 py-1 text-[10px] font-semibold text-gray-500">
                  <Package
                    size={12}
                    className="text-[#497F70]"
                  />

                  {formatNumber(
                    totalFilteredQty,
                  )}{" "}
                  Qty
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDE8E3] bg-white px-2.5 py-1 text-[10px] font-semibold text-gray-500">
                  <CircleDollarSign
                    size={12}
                    className="text-[#497F70]"
                  />

                  {formatRupiah(
                    totalNominal,
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={
                copyWhatsAppMessage
              }
              disabled={
                !filteredData.length
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#CFE0D8] bg-white px-4 text-xs font-bold text-[#35564C] shadow-sm transition hover:-translate-y-0.5 hover:border-[#497F70] hover:bg-[#F7FBF9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Copy size={15} />

              {copied
                ? "Berhasil Disalin ✓"
                : "Salin Pesan"}
            </button>

            <button
              type="button"
              onClick={
                openWhatsApp
              }
              disabled={
                !filteredData.length
              }
              style={{
                backgroundColor:
                  filteredData.length
                    ? WA_GREEN
                    : undefined,
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-xs font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MessageCircle
                size={15}
              />

              Buka WhatsApp Web

              {filteredData.length >
                0 && (
                <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px]">
                  {
                    filteredData.length
                  }
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================
          FOOTER
      ========================================================= */}
      <div className="mt-4 flex flex-col gap-2 px-1 text-[10px] text-gray-400 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Sparkles
            size={12}
            className="text-[#497F70]"
          />

          <span>
            MGB Inventory &
            Distribution ·
            Procurement
            Reporting
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Users size={12} />

          <span>
            Data ditampilkan
            berdasarkan hak akses
            user dan filter aktif.
          </span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   INLINE PURCHASE ROW + DETAIL ROW

   Detail sengaja berada di <tbody> tepat setelah
   baris Purchase Order terkait.
========================================================= */

type FragmentRowProps = {
  item: Purchase;
  index: number;
  statusConfig: {
    label: string;
    className: string;
    dot: string;
    icon: React.ReactNode;
  };
  items: PurchaseItem[];
  expanded: boolean;
  itemQty: number;
  onToggle: () => void;
  formatNumber: (
    value: unknown,
  ) => string;
  formatRupiah: (
    value: unknown,
  ) => string;
  formatDate: (
    value?: string,
  ) => string;
  getItemCode: (
    item: PurchaseItem,
  ) => string | number;
  getItemName: (
    item: PurchaseItem,
  ) => string;
  getItemQty: (
    item: PurchaseItem,
  ) => number;
  getItemUnit: (
    item: PurchaseItem,
  ) => string;
  getItemPrice: (
    item: PurchaseItem,
  ) => number;
  getItemTotal: (
    item: PurchaseItem,
  ) => number;
};

function FragmentRow({
  item,
  index,
  statusConfig,
  items,
  expanded,
  itemQty,
  onToggle,
  formatNumber,
  formatRupiah,
  formatDate,
  getItemCode,
  getItemName,
  getItemQty,
  getItemUnit,
  getItemPrice,
  getItemTotal,
}: FragmentRowProps) {
  return (
    <>
      {/* =====================================================
          PURCHASE ORDER ROW
      ===================================================== */}
      <tr className="border-b border-[#EDF2EF] align-top transition hover:bg-[#FAFCFB]">
        <td className="px-5 py-4 text-center">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#F3F6F4] text-xs font-bold text-gray-500">
            {index + 1}
          </span>
        </td>

        <td className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
              <FileText
                size={15}
              />
            </div>

            <div className="min-w-0">
              <div className="font-bold text-[#18352D]">
                {item.number ||
                  "-"}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-[#EAF3EF] px-2 py-0.5 text-[10px] font-bold text-[#497F70]">
                  PURCHASE ORDER
                </span>

                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                  {formatNumber(
                    items.length,
                  )}{" "}
                  item
                </span>
              </div>
            </div>
          </div>
        </td>

        <td className="px-5 py-4">
          <div className="flex items-center gap-2 text-gray-600">
            <CalendarDays
              size={15}
              className="text-gray-400"
            />

            <span className="font-medium">
              {formatDate(
                item.purchaseDate,
              )}
            </span>
          </div>
        </td>

        <td className="px-5 py-4">
          <div className="font-semibold text-[#18352D]">
            {item.supplier?.name ||
              "-"}
          </div>

          {item.supplier
            ?.code && (
            <div className="mt-1 inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              {
                item
                  .supplier
                  .code
              }
            </div>
          )}
        </td>

        <td className="px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F2F6F4] text-[#497F70]">
              <Building2
                size={14}
              />
            </div>

            <div>
              <div className="font-semibold text-[#18352D]">
                {item.outlet
                  ?.name ||
                  "-"}
              </div>

              {item.outlet
                ?.code && (
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  {
                    item
                      .outlet
                      .code
                  }
                </div>
              )}
            </div>
          </div>
        </td>

        <td className="px-5 py-4 text-center">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-wide ${statusConfig.className}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`}
            />

            {statusConfig.icon}

            {
              statusConfig.label
            }
          </span>
        </td>

        <td className="px-5 py-4 text-right">
          <div className="font-bold text-[#18352D]">
            {formatRupiah(
              item.total,
            )}
          </div>

          <div className="mt-1 text-[10px] text-gray-400">
            {formatNumber(
              itemQty,
            )}{" "}
            total qty
          </div>
        </td>

        <td className="px-5 py-4 text-center">
          <button
            type="button"
            onClick={onToggle}
            className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${
              expanded
                ? "border-[#497F70] bg-[#EAF3EF] text-[#35564C]"
                : "border-[#D5E2DC] bg-white text-[#497F70] hover:border-[#497F70] hover:bg-[#F5FAF7]"
            }`}
          >
            <Package
              size={14}
            />

            {expanded
              ? "Tutup"
              : "Item"}

            {expanded ? (
              <ChevronUp
                size={14}
              />
            ) : (
              <ChevronDown
                size={14}
              />
            )}
          </button>
        </td>
      </tr>

      {/* =====================================================
          DETAIL ROW
          Tepat di bawah PO yang dibuka.
      ===================================================== */}
      {expanded && (
        <tr className="border-b border-[#DDE8E3] bg-[#F8FBF9]">
          <td
            colSpan={8}
            className="p-0"
          >
            <div className="px-5 py-5 md:px-6">
              <div className="overflow-hidden rounded-2xl border border-[#DDE8E3] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#EDF2EF] bg-gradient-to-r from-[#F7FBF9] to-white px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Package
                        size={16}
                        className="text-[#497F70]"
                      />

                      <h3 className="font-bold text-[#18352D]">
                        Detail Item Purchase
                        Order
                      </h3>

                      <span className="rounded-full bg-[#EAF3EF] px-2 py-0.5 text-[10px] font-bold text-[#497F70]">
                        {formatNumber(
                          items.length,
                        )}{" "}
                        item
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-gray-400">
                      {item.supplier
                        ?.name ||
                        "Supplier -"}{" "}
                      ·{" "}
                      {item.number ||
                        "-"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-xl border border-[#DDE8E3] bg-white px-3 py-2 text-xs font-semibold text-gray-500">
                      Qty{" "}
                      <strong className="text-[#18352D]">
                        {formatNumber(
                          itemQty,
                        )}
                      </strong>
                    </span>

                    <span className="rounded-xl bg-[#18352D] px-3 py-2 text-xs font-bold text-white">
                      Subtotal{" "}
                      {formatRupiah(
                        item.total,
                      )}
                    </span>
                  </div>
                </div>

                {items.length >
                0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-xs">
                      <thead>
                        <tr className="border-b border-[#EDF2EF] bg-[#FBFCFB]">
                          <th className="w-14 px-5 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            No
                          </th>

                          <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Kode Barang
                          </th>

                          <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Nama Barang
                          </th>

                          <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Qty
                          </th>

                          <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Harga
                          </th>

                          <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Total
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {items.map(
                          (
                            detail,
                            detailIndex,
                          ) => (
                            <tr
                              key={String(
                                detail.id ??
                                  `${item.id}-${detailIndex}`,
                              )}
                              className="border-b border-[#F0F3F1] last:border-0"
                            >
                              <td className="px-5 py-3 text-center text-gray-400">
                                {detailIndex +
                                  1}
                              </td>

                              <td className="px-5 py-3">
                                <span className="rounded-md bg-gray-100 px-2 py-1 font-mono text-[10px] font-bold text-gray-600">
                                  {getItemCode(
                                    detail,
                                  )}
                                </span>
                              </td>

                              <td className="px-5 py-3">
                                <div className="font-semibold text-[#18352D]">
                                  {getItemName(
                                    detail,
                                  )}
                                </div>
                              </td>

                              <td className="px-5 py-3 text-right font-bold text-[#35564C]">
                                {formatNumber(
                                  getItemQty(
                                    detail,
                                  ),
                                )}{" "}
                                <span className="font-normal text-gray-400">
                                  {getItemUnit(
                                    detail,
                                  )}
                                </span>
                              </td>

                              <td className="px-5 py-3 text-right text-gray-500">
                                {formatRupiah(
                                  getItemPrice(
                                    detail,
                                  ),
                                )}
                              </td>

                              <td className="px-5 py-3 text-right font-bold text-[#18352D]">
                                {formatRupiah(
                                  getItemTotal(
                                    detail,
                                  ),
                                )}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>

                      <tfoot>
                        <tr className="bg-[#F7FAF8]">
                          <td
                            colSpan={
                              3
                            }
                            className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400"
                          >
                            Subtotal PO
                          </td>

                          <td className="px-5 py-3 text-right font-black text-[#35564C]">
                            {formatNumber(
                              itemQty,
                            )}
                          </td>

                          <td className="px-5 py-3 text-right text-gray-400">
                            —
                          </td>

                          <td className="px-5 py-3 text-right font-black text-[#18352D]">
                            {formatRupiah(
                              item.total,
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center">
                    <Package
                      size={22}
                      className="mx-auto text-gray-300"
                    />

                    <p className="mt-2 text-xs font-semibold text-gray-500">
                      Detail item belum
                      tersedia dari API
                      Purchase Order.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}