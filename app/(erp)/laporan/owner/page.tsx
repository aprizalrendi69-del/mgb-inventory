"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Boxes, CalendarDays, CircleAlert,
  ClipboardList, Download, FileSpreadsheet, RefreshCw, Search, ShoppingCart,
  Store, TrendingUp, Wallet, Package, Users, Banknote, Factory, Truck, Copy, FileText, MessageCircle,
} from "lucide-react";

type AnyRow = Record<string, any>;
type Dataset = { rows: AnyRow[]; payload?: any; error?: string };
type SectionKey = "overview" | "sales" | "profit" | "cash" | "purchases" | "inventory" | "outlets";
type OwnerPayload = {
  success: boolean; message?: string; summary?: AnyRow; outlets?: AnyRow[]; trend?: AnyRow[]; notes?: string[]; profit?: AnyRow; finance?: AnyRow; dataAvailability?: AnyRow; details?: AnyRow;
};
type DataState = {
  owner: OwnerPayload | null;
  purchases: Dataset; receipts: Dataset; deliveries: Dataset; inventory: Dataset;
  suppliers: Dataset; customers: Dataset; attendance: Dataset; opname: Dataset;
  petty: Dataset; accounts: Dataset; payments: Dataset; payables: Dataset;
  manufacture: Dataset; manufactureOrders: Dataset;
};

const money = (value: unknown) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value ?? 0) || 0);
const number = (value: unknown) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value ?? 0) || 0);
const dateText = (value: unknown) => {
  if (!value) return "—";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};
const today = new Date();
const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const initialFrom = localISO(new Date(today.getFullYear(), today.getMonth(), 1));
const initialTo = localISO(today);
const blankDataset: Dataset = { rows: [] };

const sections: { key: SectionKey; title: string; subtitle: string; icon: typeof Activity }[] = [
  { key: "overview", title: "Ringkasan", subtitle: "Ikhtisar kondisi perusahaan", icon: Activity },
  { key: "sales", title: "Penjualan", subtitle: "Omzet POS dan tren penjualan", icon: ShoppingCart },
  { key: "profit", title: "Laba rugi", subtitle: "Pendapatan dan indikator biaya yang tercatat", icon: TrendingUp },
  { key: "cash", title: "Kas & keuangan", subtitle: "Saldo petty cash, transaksi, pembayaran, dan utang", icon: Wallet },
  { key: "purchases", title: "Pembelian & utang", subtitle: "PO pusat/outlet, penerimaan, pembayaran, dan tagihan", icon: ClipboardList },
  { key: "inventory", title: "Stok & produksi", subtitle: "Persediaan, barang masuk/keluar, opname, produksi", icon: Boxes },
  { key: "outlets", title: "Performa outlet", subtitle: "Perbandingan penjualan, pembelian, stok, dan waste", icon: Store },
];

async function readEndpoint(url: string, dateAware = false): Promise<Dataset> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
    }
    let rows: AnyRow[] = Array.isArray(payload) ? payload :
      Array.isArray(payload?.data) ? payload.data :
      Array.isArray(payload?.items) ? payload.items : [];
    if (dateAware && rows.length) rows = rows;
    return { rows, payload };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : "Gagal mengambil data" };
  }
}

function Metric({ title, value, note, icon: Icon, tone = "navy" }: { title: string; value: string; note: string; icon: typeof Activity; tone?: "navy" | "green" | "amber" | "red" }) {
  const toneClass = {
    navy: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    red: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  };
  return <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm text-slate-500 dark:text-slate-400">{title}</p><p className="mt-2 break-words text-xl font-bold text-slate-950 dark:text-white sm:text-2xl">{value}</p></div><span className={`rounded-xl p-2.5 ${toneClass[tone]}`}><Icon size={19} /></span></div>
    <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{note}</p>
  </article>;
}

function Panel({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5 ${className}`}>
    <div className="mb-4"><h3 className="font-bold text-slate-950 dark:text-white">{title}</h3>{subtitle && <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{subtitle}</p>}</div>{children}
  </section>;
}

function DataTable({ rows, columns, empty = "Belum ada data untuk ditampilkan." }: { rows: AnyRow[]; columns: { key: string; label: string; kind?: "money" | "number" | "date" }[]; empty?: string }) {
  if (!rows.length) return <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{empty}</div>;
  const render = (row: AnyRow, col: { key: string; label: string; kind?: string }) => {
    const value = col.key.split(".").reduce((acc: any, part) => acc?.[part], row);
    if (col.kind === "money") return money(value);
    if (col.kind === "number") return number(value);
    if (col.kind === "date") return dateText(value);
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "object") return value.name ?? value.fullname ?? value.code ?? JSON.stringify(value);
    return String(value);
  };
  return <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400"><tr>{columns.map(c => <th key={c.key} className="whitespace-nowrap px-4 py-3">{c.label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{rows.map((row, index) => <tr key={String(row.id ?? row.number ?? row.code ?? index)} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">{columns.map(c => <td key={c.key} className="max-w-[360px] px-4 py-3 align-top text-slate-700 dark:text-slate-200">{render(row, c)}</td>)}</tr>)}</tbody></table></div>;
}

function DataNotice({ text }: { text: string }) {
  return <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200"><CircleAlert size={16} className="mt-0.5 shrink-0" />{text}</div>;
}

export default function OwnerReportPage() {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [section, setSection] = useState<SectionKey>("overview");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [state, setState] = useState<DataState>({
    owner: null, purchases: blankDataset, receipts: blankDataset, deliveries: blankDataset, inventory: blankDataset,
    suppliers: blankDataset, customers: blankDataset, attendance: blankDataset, opname: blankDataset,
    petty: blankDataset, accounts: blankDataset, payments: blankDataset, payables: blankDataset,
    manufacture: blankDataset, manufactureOrders: blankDataset,
  });

  const load = useCallback(async () => {
    if (!from || !to || from > to) { setError("Rentang tanggal tidak valid. Periksa tanggal awal dan akhir."); return; }
    setLoading(true); setError("");
    const month = Number(to.slice(5, 7));
    const year = Number(to.slice(0, 4));
    const query = `?start=${encodeURIComponent(from)}&end=${encodeURIComponent(to)}`;
    const [ownerResult, purchases, receipts, deliveries, inventory, suppliers, customers, attendance, opname, petty, accounts, payments, payables, manufacture, manufactureOrders] = await Promise.all([
      fetch(`/api/laporan/owner?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" }).then(async r => { const p = await r.json(); if (!r.ok || !p.success) throw new Error(p.message || "Laporan owner gagal dimuat"); return p as OwnerPayload; }).catch(e => e instanceof Error ? e : new Error("Laporan owner gagal dimuat")),
      readEndpoint("/api/laporan/purchase"),
      readEndpoint(`/api/laporan/barang-masuk${query}`),
      readEndpoint(`/api/laporan/barang-keluar${query}`),
      readEndpoint("/api/laporan/inventory"),
      readEndpoint("/api/laporan/supplier"),
      readEndpoint(`/api/laporan/customer${query}`),
      readEndpoint(`/api/laporan/attendance?month=${month}&year=${year}`),
      readEndpoint("/api/laporan/stock-opname"),
      readEndpoint("/api/petty-cash"),
      readEndpoint("/api/petty-cash/accounts"),
      readEndpoint("/api/payment"),
      readEndpoint("/api/purchase-payable"),
      readEndpoint("/api/manufacture"),
      readEndpoint("/api/manufacture/orders"),
    ]);
    if (ownerResult instanceof Error) { setError(ownerResult.message); setLoading(false); return; }
    setState({ owner: ownerResult, purchases, receipts, deliveries, inventory, suppliers, customers, attendance, opname, petty, accounts, payments, payables, manufacture, manufactureOrders });
    setUpdatedAt(new Date());
    setLoading(false);
  }, [from, to]);

  useEffect(() => { void load(); }, [load]);
  const summary = state.owner?.summary ?? {};
  const outlets = state.owner?.outlets ?? [];
  const trend = state.owner?.trend ?? [];
  const filterRows = useCallback((rows: AnyRow[]) => {
    const q = search.trim().toLocaleLowerCase("id");
    if (!q) return rows;
    return rows.filter(row => JSON.stringify(row).toLocaleLowerCase("id").includes(q));
  }, [search]);
  const currentSection = sections.find(s => s.key === section) ?? sections[0];
  const salesRows: AnyRow[] = Array.isArray(state.owner?.details?.sales) ? state.owner!.details!.sales : [];
  const salesItemRows = salesRows.flatMap((sale: AnyRow) => (Array.isArray(sale.items) ? sale.items : []).map((item: AnyRow) => ({
    receiptNumber: sale.number ?? sale.saleNumber ?? sale.invoiceNumber ?? `POS-${sale.id ?? "—"}`,
    saleDate: sale.saleDate ?? sale.createdAt,
    outletName: sale.outlet?.name ?? "—",
    cashierName: sale.user?.fullname ?? sale.user?.username ?? "—",
    itemName: item.menu?.name ?? item.barang?.name ?? item.name ?? "Item tidak bernama",
    qty: item.qty ?? item.quantity ?? 0,
    price: item.price ?? item.unitPrice ?? 0,
    total: item.total ?? item.subtotal ?? (Number(item.qty ?? item.quantity ?? 0) * Number(item.price ?? item.unitPrice ?? 0)),
  })));

  const buildWhatsAppMessage = () => {
    const profit = state.owner?.profit ?? {};
    const totalPayable = payableRows.reduce((sum, row) => sum + Math.max(0, Number(row.outstanding ?? 0)), 0);
    const overdue = payableRows.filter(row => row.dueDate && String(row.dueDate).slice(0, 10) < initialTo && Number(row.outstanding ?? 0) > 0).length;
    const pendingCount = Number(summary.pendingPayments ?? 0) + Number(summary.pendingPettyCash ?? 0) + Number(summary.lowStockCount ?? 0);
    const lines = [
      "*LAPORAN OWNER | PT. MITRA GARAM BOGATAMA*",
      "━━━━━━━━━━━━━━━━━━━━",
      `📅 *Periode:* ${dateText(from)} – ${dateText(to)}`,
      `🛒 *Penjualan POS:* ${money(summary.salesTotal)}`,
      `🧾 *Transaksi PAID:* ${number(summary.salesTransactions)}`,
      `🏷️ *Diskon POS:* ${money(profit.discount ?? summary.salesDiscountTotal)}`,
      `📦 *Estimasi HPP:* ${profit.costOfGoodsSold == null ? "Belum tersedia" : money(profit.costOfGoodsSold)}`,
      `📈 *Estimasi laba kotor:* ${profit.grossProfit == null ? "Belum tersedia" : money(profit.grossProfit)}`,
      `🔎 *Cakupan HPP:* ${number(profit.costCoveragePercentage)}% (${number(profit.costedSalesItemCount)} item terhitung, ${number(profit.uncostedSalesItemCount)} belum ada biaya)`,
      `🧺 *Total pembelian:* ${money(summary.totalPurchase)}`,
      `💳 *Sisa utang supplier:* ${money(totalPayable)}`,
      `⏰ *Tagihan lewat jatuh tempo:* ${number(overdue)}`,
      `🏦 *Saldo petty cash:* ${money(state.petty.payload?.summary?.currentBalance ?? state.owner?.finance?.pettyCashCurrentBalance)}`,
      `📊 *Nilai stok saat ini:* ${money(summary.totalInventoryValue)}`,
      `🏬 *Outlet aktif:* ${number(summary.activeOutlets)}`,
      `⚠️ *Indikator perhatian:* ${number(pendingCount)} (pembayaran pending, petty cash pending, dan stok nol/negatif)`,
      "━━━━━━━━━━━━━━━━━━━━",
      "*Catatan:* Laba kotor adalah estimasi berdasarkan BOM aktif dan biaya bahan saat ini, bukan HPP historis. Laba bersih belum disajikan karena biaya operasional dan retur belum lengkap. Nilai stok, saldo kas, dan utang merupakan posisi saat laporan dibuka.",
      "",
      "Laporan dibuat otomatis dari MGB ERP."
    ];
    return lines.join("\n");
  };

  const copyWhatsAppMessage = async () => {
    const message = buildWhatsAppMessage();
    try {
      await navigator.clipboard.writeText(message);
      setCopyStatus("Pesan berhasil disalin.");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = message;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      setCopyStatus(copied ? "Pesan berhasil disalin." : "Tidak dapat menyalin otomatis. Gunakan tombol WhatsApp Web.");
    }
    window.setTimeout(() => setCopyStatus(""), 3500);
  };

  const exportWhatsApp = () => {
    const url = `https://web.whatsapp.com/send?text=${encodeURIComponent(buildWhatsAppMessage())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const exportPdf = async () => {
    if (!state.owner) return;
    setExportingPdf(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 12;
      const emerald = [6, 78, 59] as [number, number, number];
      const paleEmerald = [220, 252, 231] as [number, number, number];
      pdf.setFillColor(...emerald);
      pdf.rect(0, 0, pageWidth, 31, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text("LAPORAN OWNER", margin, 12);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text("PT. MITRA GARAM BOGATAMA", margin, 19);
      pdf.text(`Periode: ${from} s/d ${to}`, margin, 25);
      pdf.setTextColor(30, 41, 59);
      let y = 39;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text("Ringkasan untuk Owner", margin, y);
      autoTable(pdf, {
        startY: y + 3,
        head: [["Indikator", "Nilai", "Keterangan"]],
        body: [
          ["Penjualan POS", money(summary.salesTotal), `${number(summary.salesTransactions)} transaksi PAID`],
          ["Diskon POS", money(state.owner?.profit?.discount ?? summary.salesDiscountTotal), "Diskon tercatat pada POS"],
          ["Estimasi HPP", state.owner?.profit?.costOfGoodsSold == null ? "Belum tersedia" : money(state.owner?.profit?.costOfGoodsSold), "BOM aktif + biaya bahan saat ini"],
          ["Estimasi laba kotor", state.owner?.profit?.grossProfit == null ? "Belum tersedia" : money(state.owner?.profit?.grossProfit), `${number(state.owner?.profit?.costCoveragePercentage)}% cakupan HPP`],
          ["Total pembelian", money(summary.totalPurchase), `Pusat ${money(summary.centralPurchaseTotal)} / Outlet ${money(summary.outletPurchaseTotal)}`],
          ["Sisa utang supplier", money(payableRows.reduce((sum, row) => sum + Math.max(0, Number(row.outstanding ?? 0)), 0)), "Posisi saat laporan dibuka"],
          ["Petty cash", money(state.petty.payload?.summary?.currentBalance ?? state.owner?.finance?.pettyCashCurrentBalance), "Saldo sesuai API petty cash"],
          ["Nilai persediaan", money(summary.totalInventoryValue), "Snapshot stok saat ini"],
          ["Waste disetujui", money(summary.approvedWasteValue), "Pusat + outlet"],
          ["Stok nol/negatif", number(summary.lowStockCount), "Gabungan gudang pusat dan outlet"],
        ],
        theme: "grid",
        headStyles: { fillColor: emerald, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 250, 247] },
        styles: { font: "helvetica", fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
        margin: { left: margin, right: margin },
      });
      let nextY = (pdf as any).lastAutoTable?.finalY + 8 || 105;
      const addSection = (title: string, head: string[], body: (string | number)[][]) => {
        if (nextY > 175) { pdf.addPage(); nextY = 16; }
        pdf.setTextColor(...emerald);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text(title, margin, nextY);
        autoTable(pdf, {
          startY: nextY + 2,
          head: [head],
          body: body.length ? body : [["Tidak ada data", ...Array(Math.max(0, head.length - 1)).fill("—")]],
          theme: "grid",
          headStyles: { fillColor: emerald, textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: paleEmerald },
          styles: { font: "helvetica", fontSize: 7, cellPadding: 2, overflow: "linebreak" },
          margin: { left: margin, right: margin },
          didDrawPage: () => { nextY = 16; },
        });
        nextY = ((pdf as any).lastAutoTable?.finalY ?? nextY + 10) + 8;
      };
      addSection("Performa Outlet", ["Outlet", "Kode", "Penjualan", "Pembelian", "Nilai stok", "Waste"], outlets.map((o: AnyRow) => [String(o.name ?? "—"), String(o.code ?? "—"), money(o.sales), money(o.purchases), money(o.inventoryValue), money(o.wasteValue)]));
      addSection("Rincian Struk Penjualan", ["No. struk", "Tanggal", "Outlet", "Kasir", "Total"], salesRows.map((sale: AnyRow) => [String(sale.number ?? sale.saleNumber ?? sale.invoiceNumber ?? `POS-${sale.id ?? "—"}`), dateText(sale.saleDate ?? sale.createdAt), String(sale.outlet?.name ?? "—"), String(sale.user?.fullname ?? sale.user?.username ?? "—"), money(sale.total)]));
      addSection("Rincian Item Penjualan", ["No. struk", "Item", "Qty", "Harga", "Total"], salesItemRows.map((item: AnyRow) => [String(item.receiptNumber), String(item.itemName), number(item.qty), money(item.price), money(item.total)]));
      addSection("Purchase Order", ["No. PO", "Tanggal", "Supplier", "Status", "Total"], purchases.map((row: AnyRow) => [String(row.number ?? "—"), dateText(row.date ?? row.purchaseDate ?? row.createdAt), String(row.supplier?.name ?? row.supplier ?? "—"), String(row.status ?? "—"), money(row.total)]));
      addSection("Utang Supplier", ["No. transaksi", "Invoice", "Supplier", "Jatuh tempo", "Nilai", "Dibayar", "Sisa"], payableRows.map((row: AnyRow) => [String(row.transactionNumber ?? "—"), String(row.invoiceNumber ?? "—"), String(row.supplierName ?? row.supplier?.name ?? "—"), dateText(row.dueDate), money(row.amount), money(row.paidAmount), money(row.outstanding)]));
      addSection("Mutasi Petty Cash", ["Nomor", "Tanggal", "Jenis", "Kategori", "Keterangan", "Nominal", "Status"], cashRows.map((row: AnyRow) => [String(row.number ?? "—"), dateText(row.trxDate ?? row.createdAt), String(row.type ?? "—"), String(row.category ?? "—"), String(row.description ?? "—"), money(row.amount), String(row.status ?? "—")]));
      addSection("Persediaan", ["Kode", "Barang", "Kategori", "Satuan", "Stok", "Harga beli", "Harga jual"], state.inventory.rows.map((row: AnyRow) => [String(row.code ?? "—"), String(row.name ?? "—"), String(row.category ?? "—"), String(row.unit ?? "—"), number(row.stock), money(row.purchasePrice), money(row.sellingPrice)]));
      addSection("Penerimaan Barang", ["Nomor", "Tanggal", "Supplier", "Invoice", "Status"], state.receipts.rows.map((row: AnyRow) => [String(row.number ?? "—"), dateText(row.receiptDate), String(row.supplier?.name ?? "—"), String(row.invoiceNumber ?? "—"), String(row.status ?? "—")]));
      addSection("Barang Keluar / Delivery", ["Nomor", "Tanggal", "Customer", "Status", "Nominal"], state.deliveries.rows.map((row: AnyRow) => [String(row.number ?? "—"), dateText(row.deliveryDate), String(row.customer?.name ?? "—"), String(row.status ?? "—"), money(row.totalNominal)]));
      addSection("Produksi", ["Nomor order", "Tanggal", "Outlet", "Status", "Baris item"], (state.manufactureOrders.rows.length ? state.manufactureOrders.rows : state.manufacture.rows).map((row: AnyRow) => [String(row.number ?? "—"), dateText(row.createdAt ?? row.productionDate), String(row.outlet?.name ?? "—"), String(row.status ?? "—"), number(row.items?.length ?? 0)]));
      addSection("Pembayaran Supplier", ["No. pembayaran", "Tanggal", "Supplier", "Metode", "Nominal", "Status"], paymentRows.map((row: AnyRow) => [String(row.number ?? "—"), dateText(row.paymentDate ?? row.createdAt), String(row.supplier?.name ?? row.supplierName ?? "—"), String(row.method ?? "—"), money(row.amount), String(row.status ?? "—")]));
      addSection("Akun Petty Cash", ["Kode", "Akun", "Outlet", "Saldo awal", "Saldo sekarang"], (state.accounts.rows.length ? state.accounts.rows : (state.petty.payload?.accounts ?? [])).map((row: AnyRow) => [String(row.code ?? "—"), String(row.name ?? "—"), String(row.outlet?.name ?? "Pusat"), money(row.openingBalance), money(row.currentBalance)]));
      addSection("Stock Opname", ["Kode", "Tanggal", "Outlet", "Status", "Jumlah item", "Selisih"], state.opname.rows.map((row: AnyRow) => [String(row.code ?? "—"), dateText(row.date), String(row.outlet?.name ?? "Pusat"), String(row.status ?? "—"), number(row.totalItem ?? row.items?.length ?? 0), number(row.totalDifference ?? 0)]));
      addSection("Supplier", ["Supplier", "Kota", "Jumlah PO", "Nilai PO", "Transaksi terakhir"], state.suppliers.rows.map((row: AnyRow) => [String(row.name ?? "—"), String(row.city ?? "—"), number(row.totalPO), money(row.totalValue), dateText(row.lastTransaction)]));
      addSection("Customer & Delivery", ["Customer", "Kota", "Jumlah delivery", "Total qty", "Nominal"], state.customers.rows.map((row: AnyRow) => [String(row.name ?? "—"), String(row.city ?? "—"), number(row.totalDelivery), number(row.totalQty), money(row.totalNominal)]));
      addSection("Kehadiran Karyawan", ["NIK", "Nama", "Departemen", "Hadir", "Checkout", "Belum pulang"], state.attendance.rows.map((row: AnyRow) => [String(row.nik ?? "—"), String(row.name ?? "—"), String(row.department ?? "—"), number(row.totalHadir), number(row.totalSelesai), number(row.totalBelumPulang)]));
      const pages = pdf.getNumberOfPages();
      for (let page = 1; page <= pages; page++) {
        pdf.setPage(page);
        const h = pdf.internal.pageSize.getHeight();
        pdf.setDrawColor(167, 243, 208);
        pdf.line(margin, h - 10, pageWidth - margin, h - 10);
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text("MGB ERP • Laporan Owner • Angka stok/utang/kas merupakan posisi saat laporan dibuka", margin, h - 5);
        pdf.text(`${page}/${pages}`, pageWidth - margin, h - 5, { align: "right" });
      }
      pdf.save(`laporan-owner-${from}-${to}.pdf`);
    } catch (err) {
      console.error("Gagal ekspor PDF laporan owner", err);
      alert("PDF gagal dibuat. Pastikan package jspdf dan jspdf-autotable terpasang (npm install jspdf jspdf-autotable)." );
    } finally {
      setExportingPdf(false);
    }
  };

  const exportCsv = () => {
    const rows: (string | number)[][] = [["LAPORAN OWNER - PT. MITRA GARAM BOGATAMA"], ["Periode", from, "s/d", to], [], ["Indikator", "Nilai"],
      ["Penjualan POS", Number(summary.salesTotal ?? 0)], ["Jumlah transaksi POS", Number(summary.salesTransactions ?? 0)],
      ["Pembelian pusat", Number(summary.centralPurchaseTotal ?? 0)], ["Pembelian outlet", Number(summary.outletPurchaseTotal ?? 0)],
      ["Total pembelian", Number(summary.totalPurchase ?? 0)], ["Persediaan pusat (snapshot)", Number(summary.centralInventoryValue ?? 0)],
      ["Persediaan outlet (snapshot)", Number(summary.outletInventoryValue ?? 0)], ["Utang supplier (snapshot)", Number(summary.outstandingPayables ?? 0)],
      ["Waste disetujui", Number(summary.approvedWasteValue ?? 0)], [], ["PERFORMA OUTLET", "KODE", "PENJUALAN", "PEMBELIAN", "NILAI STOK", "WASTE"],
      ...outlets.map((o: AnyRow) => [o.name ?? "-", o.code ?? "-", Number(o.sales ?? 0), Number(o.purchases ?? 0), Number(o.inventoryValue ?? 0), Number(o.wasteValue ?? 0)])];
    const csv = rows.map(row => row.map(cell => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `laporan-owner-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const purchases = useMemo(() => state.purchases.rows.filter(row => {
    const d = String(row.date ?? row.purchaseDate ?? row.createdAt ?? "").slice(0, 10);
    return !d || (d >= from && d <= to);
  }), [state.purchases.rows, from, to]);
  const cashRows = state.petty.rows.filter(row => {
    const d = String(row.trxDate ?? row.createdAt ?? "").slice(0, 10);
    return !d || (d >= from && d <= to);
  });
  const paymentRows = state.payments.rows.filter(row => {
    const d = String(row.paymentDate ?? row.createdAt ?? "").slice(0, 10);
    return !d || (d >= from && d <= to);
  });
  const payableRows = state.payables.rows;
  const purchaseTotal = purchases.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const pettyIn = cashRows.filter(row => String(row.type).toUpperCase() === "IN" && String(row.status).toUpperCase() === "APPROVED").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const pettyOut = cashRows.filter(row => String(row.type).toUpperCase() === "OUT" && String(row.status).toUpperCase() === "APPROVED").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  const tableFor = (rows: AnyRow[], columns: { key: string; label: string; kind?: "money" | "number" | "date" }[], errorText?: string) => <>
    {errorText && <DataNotice text={`Sumber data ini belum berhasil dimuat: ${errorText}. Periksa akses API dan sesi login.`} />}
    <DataTable rows={filterRows(rows)} columns={columns} />
  </>;

  return <main className="owner-report-page min-h-screen bg-[#f5f7fa] px-3 py-4 text-slate-900 dark:bg-[#061b14] dark:text-emerald-50 sm:px-6 sm:py-6 lg:px-8">
    <style jsx global>{`
      html.dark .owner-report-page { background: #061b14 !important; color: #ecfdf5 !important; }
      html.dark .owner-report-page article,
      html.dark .owner-report-page section.min-w-0,
      html.dark .owner-report-page section.rounded-2xl,
      html.dark .owner-report-page .owner-panel { background-color: #0b2b20 !important; border-color: #14533d !important; }
      html.dark .owner-report-page .bg-slate-50,
      html.dark .owner-report-page .dark\:bg-slate-800 { background-color: #10382a !important; }
      html.dark .owner-report-page .dark\:bg-slate-900 { background-color: #0b2b20 !important; }
      html.dark .owner-report-page .dark\:bg-slate-950 { background-color: #071f17 !important; }
      html.dark .owner-report-page .dark\:border-slate-800,
      html.dark .owner-report-page .dark\:border-slate-700 { border-color: #14533d !important; }
      html.dark .owner-report-page .dark\:text-slate-400,
      html.dark .owner-report-page .text-slate-500 { color: #a7c8b8 !important; }
      html.dark .owner-report-page .text-slate-700,
      html.dark .owner-report-page .dark\:text-slate-200 { color: #d1fae5 !important; }
      html.dark .owner-report-page header.owner-report-hero { background-image: linear-gradient(125deg, #06251a 0%, #064e3b 55%, #047857 100%) !important; }
      @media print { .owner-report-page { background: #fff !important; color: #111827 !important; } }
    `}</style>
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header className="owner-report-hero relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#047857] p-5 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div>
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.15em] text-emerald-200"><Activity size={14} /> Executive report</p>
          <p className="mt-4 text-sm font-medium text-slate-300">PT. MITRA GARAM BOGATAMA</p><h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Laporan Owner</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Semua kategori laporan perusahaan dalam satu halaman. Setiap menu memuat data dari API MGB ERP yang tersedia, dengan sumber dan batasan data ditampilkan secara transparan.</p>
          <p className="mt-4 text-xs text-slate-300">Periode {dateText(from)} – {dateText(to)}{updatedAt ? ` · Diperbarui ${updatedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
        </div><div className="flex flex-wrap gap-2"><button onClick={() => void load()} disabled={loading} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"><RefreshCw size={15} className={`mr-2 inline ${loading ? "animate-spin" : ""}`} />{loading ? "Memuat..." : "Perbarui"}</button><button onClick={exportCsv} disabled={!state.owner} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-50"><Download size={15} className="mr-2 inline" />Ekspor CSV</button><button onClick={() => void exportPdf()} disabled={!state.owner || exportingPdf} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"><FileText size={15} className="mr-2 inline" />{exportingPdf ? "Membuat PDF..." : "Ekspor PDF"}</button><button onClick={exportWhatsApp} disabled={!state.owner} className="rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-[#063b25] hover:bg-[#4be384] disabled:opacity-50"><MessageCircle size={15} className="mr-2 inline" />WhatsApp Web</button><button onClick={() => void copyWhatsAppMessage()} disabled={!state.owner} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"><Copy size={15} className="mr-2 inline" />Salin Pesan</button><button onClick={() => window.print()} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/15">Cetak</button></div></div>
      </header>
      {copyStatus && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-[#0b3828] dark:text-emerald-200">{copyStatus}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-col gap-4 lg:flex-row lg:items-end"><div className="flex items-center gap-2 text-sm font-bold"><CalendarDays size={18} className="text-emerald-600" /> Periode laporan</div><div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-2xl"><label className="grid gap-1.5 text-xs font-semibold text-slate-500">Dari tanggal<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><label className="grid gap-1.5 text-xs font-semibold text-slate-500">Sampai tanggal<input type="date" value={to} min={from} max={initialTo} onChange={e => setTo(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label></div><label className="relative block lg:ml-auto lg:w-72"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari di data bagian aktif..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950" /></label><button onClick={() => void load()} disabled={loading} className="rounded-xl bg-[#18352f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245447] disabled:opacity-50">Terapkan</button></div></section>
      {error && <DataNotice text={error} />}
      {loading && !state.owner && <Panel title="Memuat laporan"><div className="flex items-center justify-center gap-3 py-8 text-sm text-slate-500"><RefreshCw size={18} className="animate-spin" /> Mengambil data laporan perusahaan...</div></Panel>}
      {state.owner && <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Penjualan POS" value={money(summary.salesTotal)} note={`${number(summary.salesTransactions)} transaksi PAID pada periode`} icon={ArrowUpRight} tone="green" />
          <Metric title="Total pembelian" value={money(summary.totalPurchase)} note={`Pusat ${money(summary.centralPurchaseTotal)} · Outlet ${money(summary.outletPurchaseTotal)}`} icon={ShoppingCart} />
          <Metric title="Nilai persediaan" value={money(summary.totalInventoryValue)} note="Snapshot stok saat laporan diambil" icon={Boxes} />
          <Metric title="Utang supplier" value={money(summary.outstandingPayables)} note="Outstanding dari PurchasePayable saat ini" icon={Wallet} tone={Number(summary.outstandingPayables) > 0 ? "amber" : "green"} />
        </section>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Barang aktif" value={number(summary.activeItems)} note="Master barang aktif" icon={Package} />
          <Metric title="Supplier" value={number(summary.suppliers)} note="Jumlah supplier terdaftar" icon={Truck} />
          <Metric title="Outlet aktif" value={number(summary.activeOutlets)} note="Outlet aktif di master" icon={Store} />
          <Metric title="Indikator perhatian" value={number(Number(summary.pendingPayments ?? 0) + Number(summary.pendingPettyCash ?? 0) + Number(summary.lowStockCount ?? 0))} note={`${number(summary.pendingPayments)} pembayaran pending · ${number(summary.pendingPettyCash)} petty cash pending · ${number(summary.lowStockCount)} stok nol/negatif`} icon={CircleAlert} tone="amber" />
        </section>
        <section className="grid gap-4 xl:grid-cols-[minmax(300px,.75fr)_minmax(0,1.5fr)]">
          <Panel title="Navigasi laporan perusahaan" subtitle="Pilih bagian untuk membuka rincian datanya."><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">{sections.map(item => { const Icon = item.icon; const active = item.key === section; return <button key={item.key} onClick={() => setSection(item.key)} className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${active ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600/20 dark:border-emerald-600 dark:bg-emerald-950/30" : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"}`}><span className={`rounded-lg p-2 ${active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}><Icon size={17} /></span><span><span className="block text-sm font-bold">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{item.subtitle}</span></span></button>; })}</div></Panel>
          <Panel title={currentSection.title} subtitle={currentSection.subtitle}>
            {section === "overview" && <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><p className="text-xs text-slate-500">Gudang pusat</p><p className="mt-1 font-bold">{money(summary.centralInventoryValue)}</p></div><div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><p className="text-xs text-slate-500">Seluruh outlet</p><p className="mt-1 font-bold">{money(summary.outletInventoryValue)}</p></div><div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><p className="text-xs text-slate-500">Waste disetujui</p><p className="mt-1 font-bold">{money(summary.approvedWasteValue)}</p></div></div>
              <Panel title="Tren penjualan harian" subtitle="Nilai berdasarkan transaksi POS berstatus PAID."><div className="max-h-80 space-y-2 overflow-auto">{trend.length ? trend.map((t: AnyRow) => <div key={t.date} className="grid grid-cols-[100px_minmax(0,1fr)_auto] items-center gap-3 text-sm"><span className="text-xs text-slate-500">{dateText(t.date)}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(1, Math.min(100, Number(t.sales ?? 0) / Math.max(1, ...trend.map((x: AnyRow) => Number(x.sales ?? 0))) * 100))}%` }} /></div><strong>{money(t.sales)}</strong></div>) : <p className="py-5 text-center text-sm text-slate-500">Tidak ada penjualan pada periode ini.</p>}</div></Panel>
              <Panel title="Performa outlet"><DataTable rows={filterRows(outlets)} columns={[{ key: "name", label: "Outlet" }, { key: "code", label: "Kode" }, { key: "sales", label: "Penjualan", kind: "money" }, { key: "purchases", label: "Pembelian", kind: "money" }, { key: "inventoryValue", label: "Nilai stok", kind: "money" }, { key: "wasteValue", label: "Waste", kind: "money" }]} /></Panel>
            </div>}
            {section === "sales" && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><Metric title="Penjualan POS" value={money(summary.salesTotal)} note="Hanya transaksi PAID dalam periode" icon={ShoppingCart} tone="green" /><Metric title="Jumlah transaksi" value={number(summary.salesTransactions)} note="Jumlah transaksi POS yang dihitung API" icon={ClipboardList} /></div><Panel title="Penjualan harian"><DataTable rows={filterRows(trend)} columns={[{ key: "date", label: "Tanggal", kind: "date" }, { key: "sales", label: "Penjualan", kind: "money" }]} /></Panel><Panel title="Rincian nomor struk" subtitle="Transaksi PAID yang dikembalikan API owner untuk periode terpilih."><DataTable rows={filterRows(salesRows)} columns={[{ key: "number", label: "No. struk" }, { key: "saleDate", label: "Tanggal", kind: "date" }, { key: "outlet.name", label: "Outlet" }, { key: "user.fullname", label: "Kasir" }, { key: "items.length", label: "Jenis item", kind: "number" }, { key: "subtotal", label: "Subtotal", kind: "money" }, { key: "discount", label: "Diskon", kind: "money" }, { key: "total", label: "Total", kind: "money" }]} empty={state.owner?.dataAvailability?.sales?.available ? "Tidak ada struk PAID pada periode ini." : "API belum menyediakan rincian struk."} /></Panel><Panel title="Rincian item per struk" subtitle="Daftar menu/barang, kuantitas, harga dan nilai baris yang tercatat pada POS."><DataTable rows={filterRows(salesItemRows)} columns={[{ key: "receiptNumber", label: "No. struk" }, { key: "saleDate", label: "Tanggal", kind: "date" }, { key: "outletName", label: "Outlet" }, { key: "cashierName", label: "Kasir" }, { key: "itemName", label: "Menu / barang" }, { key: "qty", label: "Qty", kind: "number" }, { key: "price", label: "Harga", kind: "money" }, { key: "total", label: "Total", kind: "money" }]} empty="Belum ada item penjualan pada periode ini." /></Panel></div>}
            {section === "profit" && <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Metric title="Penjualan bersih" value={money(state.owner?.profit?.netSales ?? summary.salesTotal)} note="Total transaksi POS PAID setelah diskon yang tersimpan" icon={TrendingUp} tone="green" />
                <Metric title="Estimasi HPP terjual" value={state.owner?.profit?.costOfGoodsSold == null ? "Belum tersedia" : money(state.owner?.profit?.costOfGoodsSold)} note="BOM aktif + averageCost saat ini; bukan HPP historis" icon={Boxes} />
                <Metric title="Estimasi laba kotor" value={state.owner?.profit?.grossProfit == null ? "Belum tersedia" : money(state.owner?.profit?.grossProfit)} note="Penjualan bersih dikurangi estimasi HPP bahan" icon={ArrowUpRight} tone={Number(state.owner?.profit?.grossProfit ?? 0) >= 0 ? "green" : "red"} />
                <Metric title="Diskon POS" value={money(state.owner?.profit?.discount ?? summary.salesDiscountTotal)} note="Diskon yang tercatat pada transaksi POS" icon={ArrowDownRight} tone="amber" />
                <Metric title="Cakupan HPP" value={`${number(state.owner?.profit?.costCoveragePercentage)}%`} note={`${number(state.owner?.profit?.costedSalesItemCount)} item dihitung · ${number(state.owner?.profit?.uncostedSalesItemCount)} item belum punya biaya`} icon={Activity} />
                <Metric title="Laba bersih" value="Belum tersedia" note="Belum menghitung seluruh biaya operasional, retur, dan biaya non-stok" icon={CircleAlert} tone="amber" />
              </div>
              <DataNotice text={String(state.owner?.profit?.explanation ?? "Estimasi laba kotor menggunakan averageCost stok saat ini atau harga beli master sebagai fallback. Angka ini bukan laporan laba rugi final.")} />
              <Panel title="Rincian transaksi pembelian" subtitle="Pembelian bukan HPP langsung; pembelian bisa menambah persediaan dan belum tentu seluruhnya terjual pada periode yang sama."><DataTable rows={filterRows(purchases)} columns={[{ key: "number", label: "No. PO" }, { key: "date", label: "Tanggal", kind: "date" }, { key: "supplier", label: "Supplier" }, { key: "status", label: "Status" }, { key: "total", label: "Nilai", kind: "money" }]} /></Panel>
            </div>}
            {section === "cash" && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Saldo petty cash pusat & outlet" value={money(state.petty.payload?.summary?.currentBalance)} note="Saldo menurut ringkasan API petty cash; lihat saldo tiap akun di bawah" icon={Wallet} tone="green" /><Metric title="Petty cash masuk" value={money(pettyIn)} note="Transaksi IN berstatus APPROVED pada periode" icon={ArrowUpRight} tone="green" /><Metric title="Petty cash keluar" value={money(pettyOut)} note="Transaksi OUT berstatus APPROVED pada periode" icon={ArrowDownRight} tone="red" /><Metric title="Pembayaran tercatat" value={number(paymentRows.length)} note="Payment pada periode terpilih" icon={Banknote} /></div><Panel title="Saldo setiap akun petty cash" subtitle="Saldo akun berasal dari PettyCashAccount. Pusat dan outlet tetap dipisahkan.">{tableFor(state.accounts.rows.length ? state.accounts.rows : (state.petty.payload?.accounts ?? []), [{ key: "code", label: "Kode" }, { key: "name", label: "Akun" }, { key: "outlet.name", label: "Outlet" }, { key: "openingBalance", label: "Saldo awal", kind: "money" }, { key: "currentBalance", label: "Saldo sekarang", kind: "money" }], state.accounts.error)}</Panel><Panel title="Mutasi petty cash"><DataTable rows={filterRows(cashRows)} columns={[{ key: "number", label: "Nomor" }, { key: "trxDate", label: "Tanggal", kind: "date" }, { key: "outlet.name", label: "Outlet" }, { key: "type", label: "Jenis" }, { key: "category", label: "Kategori" }, { key: "description", label: "Keterangan" }, { key: "amount", label: "Nominal", kind: "money" }, { key: "status", label: "Status" }]} /></Panel><Panel title="Pembayaran supplier"><DataTable rows={filterRows(paymentRows)} columns={[{ key: "number", label: "No. pembayaran" }, { key: "paymentDate", label: "Tanggal", kind: "date" }, { key: "supplier.name", label: "Supplier" }, { key: "method", label: "Metode" }, { key: "amount", label: "Nominal", kind: "money" }, { key: "status", label: "Status" }, { key: "referenceNumber", label: "Referensi" }]} /></Panel><DataNotice text="Saldo rekening bank tidak ditampilkan karena ZIP sumber tidak memiliki model rekening bank/mutasi bank yang bisa dijadikan sumber saldo. Penjualan juga tidak dianggap sebagai saldo kas. Untuk rekonsiliasi kas fisik, perlu input hasil hitung kas aktual." /></div>}
            {section === "purchases" && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Metric title="Pembelian pada daftar PO" value={money(summary.totalPurchase)} note="Total pembelian pusat + outlet dari ringkasan API owner" icon={ShoppingCart} /><Metric title="Utang supplier" value={money(payableRows.reduce((s, r) => s + Math.max(0, Number(r.outstanding ?? 0)), 0))} note="Jumlah outstanding dari PurchasePayable" icon={Wallet} tone="amber" /><Metric title="Tagihan jatuh tempo" value={number(payableRows.filter(r => r.dueDate && String(r.dueDate).slice(0, 10) < initialTo && Number(r.outstanding ?? 0) > 0).length)} note="Tagihan dengan jatuh tempo sebelum hari ini dan outstanding positif" icon={CircleAlert} tone="red" /></div><Panel title="Purchase Order pusat & outlet" subtitle="Data PO dari endpoint laporan purchase; gunakan status dan nominal untuk menelusuri dokumen.">{tableFor(purchases, [{ key: "number", label: "No. PO" }, { key: "date", label: "Tanggal", kind: "date" }, { key: "supplier", label: "Supplier" }, { key: "status", label: "Status" }, { key: "total", label: "Total", kind: "money" }], state.purchases.error)}</Panel><Panel title="Penerimaan barang pusat"><DataTable rows={filterRows(state.receipts.rows)} columns={[{ key: "number", label: "No. penerimaan" }, { key: "receiptDate", label: "Tanggal", kind: "date" }, { key: "supplier.name", label: "Supplier" }, { key: "invoiceNumber", label: "No. invoice" }, { key: "status", label: "Status" }, { key: "items.length", label: "Jumlah baris", kind: "number" }]} /></Panel><Panel title="Tagihan / utang supplier"><DataTable rows={filterRows(payableRows)} columns={[{ key: "transactionNumber", label: "No. transaksi" }, { key: "invoiceNumber", label: "No. invoice" }, { key: "supplierName", label: "Supplier" }, { key: "outletName", label: "Outlet" }, { key: "invoiceDate", label: "Tanggal invoice", kind: "date" }, { key: "dueDate", label: "Jatuh tempo", kind: "date" }, { key: "amount", label: "Nilai tagihan", kind: "money" }, { key: "paidAmount", label: "Dibayar", kind: "money" }, { key: "outstanding", label: "Sisa utang", kind: "money" }, { key: "status", label: "Status" }]} /></Panel><Panel title="Pembayaran supplier"><DataTable rows={filterRows(paymentRows)} columns={[{ key: "number", label: "No. pembayaran" }, { key: "paymentDate", label: "Tanggal", kind: "date" }, { key: "supplier.name", label: "Supplier" }, { key: "method", label: "Metode" }, { key: "amount", label: "Nominal", kind: "money" }, { key: "status", label: "Status" }]} /></Panel></div>}
            {section === "inventory" && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Metric title="Nilai stok pusat" value={money(summary.centralInventoryValue)} note="Snapshot berdasarkan Inventory stock × averageCost" icon={Boxes} /><Metric title="Nilai stok outlet" value={money(summary.outletInventoryValue)} note="Snapshot berdasarkan OutletStock stock × averageCost" icon={Store} /><Metric title="Stok nol/negatif" value={number(summary.lowStockCount)} note="Gabungan gudang pusat dan outlet" icon={CircleAlert} tone="amber" /></div><Panel title="Master barang & stok" subtitle="Data barang dari API inventory.">{tableFor(state.inventory.rows, [{ key: "code", label: "Kode" }, { key: "name", label: "Nama barang" }, { key: "category", label: "Kategori" }, { key: "unit", label: "Satuan" }, { key: "stock", label: "Stok master", kind: "number" }, { key: "purchasePrice", label: "Harga beli", kind: "money" }, { key: "sellingPrice", label: "Harga jual", kind: "money" }], state.inventory.error)}</Panel><Panel title="Barang masuk"><DataTable rows={filterRows(state.receipts.rows)} columns={[{ key: "number", label: "Nomor" }, { key: "receiptDate", label: "Tanggal", kind: "date" }, { key: "supplier.name", label: "Supplier" }, { key: "purchase.number", label: "No. PO" }, { key: "items.length", label: "Baris item", kind: "number" }, { key: "status", label: "Status" }]} /></Panel><Panel title="Barang keluar / delivery"><DataTable rows={filterRows(state.deliveries.rows)} columns={[{ key: "number", label: "No. delivery" }, { key: "deliveryDate", label: "Tanggal", kind: "date" }, { key: "customer.name", label: "Customer" }, { key: "status", label: "Status" }, { key: "totalNominal", label: "Nilai", kind: "money" }]} /></Panel><Panel title="Stock opname"><DataTable rows={filterRows(state.opname.rows)} columns={[{ key: "code", label: "Kode opname" }, { key: "date", label: "Tanggal", kind: "date" }, { key: "status", label: "Status" }, { key: "totalItem", label: "Jumlah item", kind: "number" }, { key: "totalDifference", label: "Selisih absolut", kind: "number" }]} /></Panel><Panel title="Order produksi / manufacture"><DataTable rows={filterRows(state.manufactureOrders.rows.length ? state.manufactureOrders.rows : state.manufacture.rows)} columns={[{ key: "number", label: "Nomor order" }, { key: "createdAt", label: "Dibuat", kind: "date" }, { key: "outlet.name", label: "Outlet" }, { key: "status", label: "Status" }, { key: "items.length", label: "Baris bahan/produk", kind: "number" }]} /></Panel><DataNotice text="Nilai aset stok adalah snapshot saat ini, bukan histori persediaan pada akhir periode. Endpoint manufacture membatasi data berdasarkan hak akses akun; jika tidak memiliki izin, tabel akan menampilkan status sumber gagal dimuat." /></div>}
            {section === "outlets" && <div className="space-y-4"><Panel title="Perbandingan performa outlet" subtitle="Penjualan dan pembelian mengikuti periode; nilai stok adalah snapshot terkini."><DataTable rows={filterRows(outlets)} columns={[{ key: "name", label: "Outlet" }, { key: "code", label: "Kode" }, { key: "sales", label: "Penjualan POS", kind: "money" }, { key: "purchases", label: "Pembelian", kind: "money" }, { key: "inventoryValue", label: "Nilai stok", kind: "money" }, { key: "wasteValue", label: "Waste disetujui", kind: "money" }]} /></Panel><Panel title="Customer & delivery"><DataTable rows={filterRows(state.customers.rows)} columns={[{ key: "name", label: "Customer" }, { key: "city", label: "Kota" }, { key: "totalDelivery", label: "Jumlah delivery", kind: "number" }, { key: "totalQty", label: "Total qty", kind: "number" }, { key: "totalNominal", label: "Nominal", kind: "money" }]} /></Panel><Panel title="Supplier"><DataTable rows={filterRows(state.suppliers.rows)} columns={[{ key: "name", label: "Supplier" }, { key: "city", label: "Kota" }, { key: "totalPO", label: "Jumlah PO", kind: "number" }, { key: "totalValue", label: "Nilai PO", kind: "money" }, { key: "lastTransaction", label: "Transaksi terakhir", kind: "date" }]} /></Panel><Panel title="Kehadiran karyawan"><DataTable rows={filterRows(state.attendance.rows)} columns={[{ key: "nik", label: "NIK" }, { key: "name", label: "Nama" }, { key: "department", label: "Departemen" }, { key: "totalHadir", label: "Hadir", kind: "number" }, { key: "totalSelesai", label: "Sudah checkout", kind: "number" }, { key: "totalBelumPulang", label: "Belum checkout", kind: "number" }]} /></Panel></div>}
          </Panel>
        </section>
        <footer className="pb-4 text-center text-xs text-slate-400">MGB ERP · Laporan Owner Terpadu · Data ditampilkan dari endpoint yang tersedia di proyek.</footer>
      </>}
    </div>
  </main>;
}
