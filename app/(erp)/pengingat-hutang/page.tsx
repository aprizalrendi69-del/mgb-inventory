
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronRight,
  CircleDollarSign,
  Copy,
  ExternalLink,
  FileText,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Users,
  WalletCards,
  X,
} from "lucide-react";

type Payable = {
  id: number;
  supplierName: string;
  invoiceNumber: string;
  source: string;
  invoiceDate: string | null;
  dueDate: string | null;
  dueDateKey: string | null;
  daysLeft: number | null;
  amount: number;
  paidAmount: number;
  outstanding: number;
  status: string;
  supplierPhone?: string | null;
  whatsappPhone?: string | null;
};

type Reminder = {
  id: number;
  payableId: number;
  stage: string;
  supplierName: string;
  invoiceNumber: string;
  outstanding: number;
  dueDate: string;
  source: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  whatsappStatus: string;
  whatsappSentAt: string | null;
  whatsappError: string | null;
  supplierPhone?: string | null;
  whatsappPhone?: string | null;
};

type Recipient = {
  id: number;
  fullname: string;
  username: string;
  role: string;
  whatsappPhone: string | null;
};

type DashboardData = {
  ok: boolean;
  today: string;
  summary: {
    openPayables: number;
    totalOutstanding: number;
    overdueCount: number;
    dueTodayCount: number;
    next7DaysCount: number;
    unreadReminders: number;
  };
  payables: Payable[];
  reminders: Reminder[];
  whatsappConfigured: boolean;
};

type InvoiceLine = {
  id: number;
  invoiceNumber: string;
  source: string;
  invoiceDate: string | null;
  dueDate: string | null;
  daysLeft: number | null;
  amount: number;
  paidAmount: number;
  outstanding: number;
};

type SupplierGroup = {
  supplierName: string;
  phone: string;
  invoices: InvoiceLine[];
  total: number;
};

type WhatsAppTarget = {
  mode: "SUPPLIER" | "INTERNAL";
  recipientName: string;
  phone: string;
  supplierName?: string;
  invoices: InvoiceLine[];
  message: string;
};

const IDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const DATE = (value?: string | null) => {
  if (!value) return "Belum ditentukan";

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? "Belum ditentukan"
    : d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      });
};

function dueLabel(days: number | null) {
  if (days == null) return "Tempo belum diatur";
  if (days < 0) return `Terlambat ${Math.abs(days)} hari`;
  if (days === 0) return "Jatuh tempo hari ini";
  if (days === 1) return "Besok";
  return `${days} hari lagi`;
}

function statusTone(status: string) {
  if (["TERLAMBAT", "OVERDUE"].includes(status)) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300";
  }

  if (["DUE", "SEGERA", "H-1"].includes(status)) {
    return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
  }

  if (status === "SENT") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
  }

  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function stageLabel(stage: string) {
  if (stage === "DUE") return "Hari H";
  if (stage === "OVERDUE") return "Terlambat";
  return stage;
}

function normalizePhone(value: string) {
  let phone = value.replace(/[^\d+]/g, "");

  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("0")) phone = `62${phone.slice(1)}`;
  if (phone.startsWith("8")) phone = `62${phone}`;

  return phone.replace(/\D/g, "");
}

function phoneOf(p: Payable) {
  return normalizePhone(p.supplierPhone || p.whatsappPhone || "");
}

function toInvoiceLine(p: Payable): InvoiceLine {
  return {
    id: p.id,
    invoiceNumber: p.invoiceNumber || "-",
    source: p.source || "-",
    invoiceDate: p.invoiceDate,
    dueDate: p.dueDate,
    daysLeft: p.daysLeft,
    amount: p.amount,
    paidAmount: p.paidAmount,
    outstanding: p.outstanding,
  };
}

function groupPayables(payables: Payable[]): SupplierGroup[] {
  const groups = new Map<string, SupplierGroup>();

  for (const p of payables) {
    if (!(p.outstanding > 0)) continue;

    const name = p.supplierName.trim() || "Supplier tanpa nama";
    const key = name.toLocaleLowerCase("id-ID");
    const existing = groups.get(key);
    const invoice = toInvoiceLine(p);

    if (existing) {
      existing.invoices.push(invoice);
      existing.total += p.outstanding;

      if (!existing.phone) {
        existing.phone = phoneOf(p);
      }
    } else {
      groups.set(key, {
        supplierName: name,
        phone: phoneOf(p),
        invoices: [invoice],
        total: p.outstanding,
      });
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      invoices: [...group.invoices].sort((a, b) => {
        if (a.daysLeft == null) return 1;
        if (b.daysLeft == null) return -1;
        return a.daysLeft - b.daysLeft;
      }),
    }))
    .sort((a, b) => a.supplierName.localeCompare(b.supplierName, "id"));
}

/**
 * Pesan supplier dibuat sebagai konfirmasi kewajiban MGB kepada supplier.
 * Pesan ini bukan penagihan kepada supplier.
 */
function buildSupplierMessage(
  supplierName: string,
  invoices: InvoiceLine[]
) {
  const openInvoices = invoices.filter((invoice) => invoice.outstanding > 0);
  const total = openInvoices.reduce(
    (sum, invoice) => sum + invoice.outstanding,
    0
  );

  const invoiceLines = openInvoices.map((invoice, index) =>
    [
      `${index + 1}. Invoice: ${invoice.invoiceNumber}`,
      `   Sisa kewajiban MGB: ${IDR(invoice.outstanding)}`,
      `   Tanggal invoice: ${DATE(invoice.invoiceDate)}`,
      `   Jatuh tempo: ${DATE(invoice.dueDate)}`,
      `   Keterangan: ${dueLabel(invoice.daysLeft)}`,
    ].join("\n")
  );

  return [
    `Yth. Tim ${supplierName},`,
    "",
    "Salam hangat dari PT. Mitra Garam Bogatama (MGB).",
    "",
    "Melalui pesan ini, tim Finance MGB bermaksud melakukan konfirmasi dan rekonsiliasi atas kewajiban pembayaran kami kepada pihak supplier.",
    "",
    "Berdasarkan catatan administrasi kami, berikut rincian invoice yang masih tercatat memiliki saldo terbuka:",
    "",
    ...invoiceLines.flatMap((line) => [line, ""]),
    "━━━━━━━━━━━━━━━━━━━━",
    `JUMLAH INVOICE: ${openInvoices.length}`,
    `TOTAL SISA KEWAJIBAN MGB: ${IDR(total)}`,
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "Mohon bantuan tim Bapak/Ibu untuk mengonfirmasi apakah rincian invoice dan saldo tersebut telah sesuai dengan catatan pihak supplier.",
    "",
    "Apabila terdapat pembayaran yang sudah kami lakukan tetapi belum tercatat, perbedaan nominal, perubahan jatuh tempo, atau informasi lain yang perlu disesuaikan, mohon diinformasikan kepada tim Finance MGB agar dapat kami rekonsiliasi.",
    "",
    "Pesan ini merupakan konfirmasi administrasi atas kewajiban pembayaran MGB, bukan permintaan penagihan kepada pihak supplier.",
    "",
    "Terima kasih atas kerja sama dan dukungan yang telah terjalin dengan baik.",
    "",
    "Hormat kami,",
    "Finance",
    "PT. Mitra Garam Bogatama (MGB)",
  ].join("\n");
}

function buildInternalMessage(
  payables: Payable[],
  recipientName: string
) {
  const openPayables = payables.filter((p) => p.outstanding > 0);
  const groups = groupPayables(openPayables);
  const total = groups.reduce((sum, group) => sum + group.total, 0);

  const overdue = openPayables.filter(
    (p) => p.daysLeft != null && p.daysLeft < 0
  );
  const dueToday = openPayables.filter((p) => p.daysLeft === 0);
  const next7 = openPayables.filter(
    (p) => p.daysLeft != null && p.daysLeft >= 1 && p.daysLeft <= 7
  );

  const supplierLines = groups.map((group, index) => {
    const details = group.invoices.map(
      (invoice, invoiceIndex) =>
        `   ${invoiceIndex + 1}) ${invoice.invoiceNumber} | Sisa ${IDR(invoice.outstanding)} | Tempo ${DATE(invoice.dueDate)} | ${dueLabel(invoice.daysLeft)}`
    );

    return [
      `${index + 1}. ${group.supplierName}`,
      `   Total kewajiban: ${IDR(group.total)}`,
      ...details,
    ].join("\n");
  });

  return [
    `Yth. ${recipientName},`,
    "",
    "REKAP INTERNAL KEWAJIBAN PEMBAYARAN SUPPLIER",
    "PT. MITRA GARAM BOGATAMA (MGB)",
    `Tanggal laporan: ${DATE(new Date().toISOString())}`,
    "",
    "Berikut ringkasan tagihan supplier yang masih memiliki saldo terbuka berdasarkan data PurchasePayable di MGB ERP.",
    "",
    "RINGKASAN KEUANGAN",
    "━━━━━━━━━━━━━━━━━━━━",
    `Total supplier: ${groups.length}`,
    `Total invoice terbuka: ${openPayables.length}`,
    `Total sisa kewajiban: ${IDR(total)}`,
    `Invoice terlambat: ${overdue.length}`,
    `Invoice jatuh tempo hari ini: ${dueToday.length}`,
    `Invoice jatuh tempo 7 hari ke depan: ${next7.length}`,
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "RINCIAN PER SUPPLIER",
    "",
    ...(supplierLines.length
      ? supplierLines.flatMap((line) => [line, ""])
      : ["Tidak ada tagihan terbuka saat laporan dibuat.", ""]),
    "ARAHAN TINDAK LANJUT",
    "1. Tinjau invoice yang telah melewati tanggal jatuh tempo.",
    "2. Koordinasikan prioritas dan jadwal pembayaran bersama Finance/Management.",
    "3. Cocokkan pembayaran yang sudah dilakukan dengan catatan supplier dan ERP.",
    "4. Perbarui status pembayaran setelah transaksi terverifikasi.",
    "",
    "Catatan: nilai pada laporan ini merupakan kewajiban MGB kepada supplier, bukan piutang yang harus ditagih kepada supplier.",
    "",
    "MGB ERP | Finance Control Center",
  ].join("\n");
}

function WhatsAppIcon({ size = 17 }: { size?: number }) {
  return <MessageCircle size={size} />;
}

function Kpi({
  title,
  value,
  detail,
  icon,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone: "emerald" | "rose" | "amber" | "blue";
}) {
  const tones = {
    emerald:
      "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
    rose:
      "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900",
    amber:
      "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
    blue:
      "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900",
  };

  return (
    <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="mt-2 break-words text-xl font-bold tracking-tight text-slate-900 dark:text-orange-300 sm:text-2xl">
            {value}
          </p>
        </div>
        <div className={`rounded-xl p-3 ring-1 ${tones[tone]}`}>{icon}</div>
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {detail}
      </p>
    </div>
  );
}

function TableMessage({ text }: { text: string }) {
  return (
    <tr>
      <td
        colSpan={7}
        className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
      >
        {text}
      </td>
    </tr>
  );
}

export default function PengingatHutangPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [canEditRecipients, setCanEditRecipients] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [savingPhone, setSavingPhone] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [tab, setTab] = useState<"payables" | "history" | "settings">(
    "payables"
  );

  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [waTarget, setWaTarget] = useState<WhatsAppTarget | null>(null);
  const [waPhone, setWaPhone] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedInvoiceId, setCopiedInvoiceId] = useState<number | null>(null);
  const [copiedSupplierKey, setCopiedSupplierKey] = useState<string | null>(
    null
  );
  const [selectedInternalRecipient, setSelectedInternalRecipient] =
    useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);

    try {
      const [response, recipientResponse] = await Promise.all([
        fetch("/api/payable-reminders", { cache: "no-store" }),
        fetch("/api/payable-reminders/recipients", { cache: "no-store" }),
      ]);

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Gagal memuat pengingat hutang.");
      }

      setData(payload);

      if (recipientResponse.ok) {
        const recipientPayload = await recipientResponse.json();
        const users = (recipientPayload.users ?? []).map((u: Recipient) => ({
          ...u,
        }));

        setRecipients(users);
        setCanEditRecipients(Boolean(recipientPayload.canEdit));

        setSelectedInternalRecipient((current) => {
          if (current && users.some((u: Recipient) => String(u.id) === current)) {
            return current;
          }

          const firstWithPhone = users.find((u: Recipient) =>
            Boolean(normalizePhone(u.whatsappPhone || ""))
          );

          return firstWithPhone ? String(firstWithPhone.id) : "";
        });
      }
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Gagal memuat data.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredPayables = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("id-ID");

    return (data?.payables ?? []).filter((p) => {
      const matchesQuery =
        !normalized ||
        `${p.supplierName} ${p.invoiceNumber} ${p.source}`
          .toLocaleLowerCase("id-ID")
          .includes(normalized);

      const matchesFilter =
        filter === "ALL" ||
        (filter === "OVERDUE" && p.daysLeft != null && p.daysLeft < 0) ||
        (filter === "TODAY" && p.daysLeft === 0) ||
        (filter === "NEXT7" &&
          p.daysLeft != null &&
          p.daysLeft >= 0 &&
          p.daysLeft <= 7) ||
        (filter === "NO_DATE" && p.daysLeft == null);

      return matchesQuery && matchesFilter;
    });
  }, [data, filter, query]);

  const supplierGroups = useMemo(
    () => groupPayables(data?.payables ?? []),
    [data]
  );

  async function copyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice({ type: "success", text: successMessage });
      return true;
    } catch {
      setNotice({
        type: "error",
        text: "Tidak dapat menyalin otomatis. Silakan salin pesan dari pratinjau.",
      });
      return false;
    }
  }

  async function copySupplierMessage(p: Payable) {
    const key = p.supplierName.trim().toLocaleLowerCase("id-ID");
    const group = supplierGroups.find(
      (item) => item.supplierName.toLocaleLowerCase("id-ID") === key
    );
    const invoices = group?.invoices ?? [toInvoiceLine(p)];
    const message = buildSupplierMessage(
      p.supplierName || "Supplier",
      invoices
    );

    const ok = await copyText(
      message,
      `Pesan WhatsApp untuk ${p.supplierName} berhasil disalin.`
    );

    if (ok) {
      setCopiedInvoiceId(p.id);
      setCopiedSupplierKey(key);
    }
  }

  async function copyAllSupplierMessages() {
    const messages = supplierGroups.map((group) =>
      buildSupplierMessage(group.supplierName, group.invoices)
    );

    if (!messages.length) {
      setNotice({
        type: "error",
        text: "Tidak ada invoice dengan sisa hutang untuk disalin.",
      });
      return;
    }

    const ok = await copyText(
      messages.join("\n\n\n================================\n\n\n"),
      `Pesan untuk ${messages.length} supplier berhasil disalin.`
    );

    if (ok) setCopiedSupplierKey("ALL");
  }

  async function runCheck() {
    setChecking(true);
    setNotice(null);

    try {
      const response = await fetch("/api/payable-reminders", {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Pemeriksaan gagal.");
      }

      setNotice({
        type: "success",
        text: `Pemeriksaan selesai. ${payload.createdReminders ?? 0} pengingat baru dibuat. Pengiriman WhatsApp tetap manual melalui WhatsApp Web.`,
      });

      await load(true);
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Pemeriksaan gagal.",
      });
    } finally {
      setChecking(false);
    }
  }

  async function markRead(reminder: Reminder) {
    try {
      const response = await fetch(
        `/api/payable-reminders/${reminder.id}/read`,
        { method: "PATCH" }
      );

      if (!response.ok) {
        throw new Error("Gagal menandai pengingat sebagai dibaca.");
      }

      setData((old) =>
        old
          ? {
              ...old,
              reminders: old.reminders.map((item) =>
                item.id === reminder.id
                  ? { ...item, readAt: new Date().toISOString() }
                  : item
              ),
              summary: {
                ...old.summary,
                unreadReminders: Math.max(
                  0,
                  old.summary.unreadReminders - (reminder.readAt ? 0 : 1)
                ),
              },
            }
          : old
      );
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Gagal menandai pengingat sebagai dibaca.",
      });
    }
  }

  async function savePhone(recipient: Recipient) {
    setSavingPhone(recipient.id);
    setNotice(null);

    try {
      const response = await fetch("/api/payable-reminders/recipients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: recipient.id,
          whatsappPhone: recipient.whatsappPhone ?? "",
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Nomor WhatsApp gagal disimpan.");
      }

      setNotice({
        type: "success",
        text: `Nomor WhatsApp ${recipient.fullname} berhasil disimpan.`,
      });

      await load(true);
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Gagal menyimpan nomor.",
      });
    } finally {
      setSavingPhone(null);
    }
  }

  function openWhatsAppDialog(target: WhatsAppTarget) {
    setWaTarget(target);
    setWaPhone(normalizePhone(target.phone));
    setWaMessage(target.message);
    setCopiedMessage(false);
  }

  function openFromPayable(p: Payable) {
    const key = p.supplierName.trim().toLocaleLowerCase("id-ID");
    const group = supplierGroups.find(
      (item) => item.supplierName.toLocaleLowerCase("id-ID") === key
    );
    const invoices = group?.invoices ?? [toInvoiceLine(p)];
    const supplierName = p.supplierName || "Supplier";

    openWhatsAppDialog({
      mode: "SUPPLIER",
      recipientName: supplierName,
      supplierName,
      phone: group?.phone || phoneOf(p),
      invoices,
      message: buildSupplierMessage(supplierName, invoices),
    });
  }

  function openFromReminder(r: Reminder) {
    const payable = data?.payables.find((p) => p.id === r.payableId);

    if (payable) {
      openFromPayable(payable);
      return;
    }

    const invoices: InvoiceLine[] = [
      {
        id: r.payableId,
        invoiceNumber: r.invoiceNumber,
        source: r.source,
        invoiceDate: null,
        dueDate: r.dueDate || null,
        daysLeft: null,
        amount: r.outstanding,
        paidAmount: 0,
        outstanding: r.outstanding,
      },
    ];

    openWhatsAppDialog({
      mode: "SUPPLIER",
      recipientName: r.supplierName,
      supplierName: r.supplierName,
      phone: normalizePhone(r.supplierPhone || r.whatsappPhone || ""),
      invoices,
      message: buildSupplierMessage(r.supplierName, invoices),
    });
  }

  function openInternalSummary() {
    const recipient = recipients.find(
      (r) => String(r.id) === selectedInternalRecipient
    );

    if (!recipient) {
      setNotice({
        type: "error",
        text: "Pilih penerima Finance/Management terlebih dahulu.",
      });
      return;
    }

    const phone = normalizePhone(recipient.whatsappPhone || "");

    if (!phone) {
      setNotice({
        type: "error",
        text: `Nomor WhatsApp ${recipient.fullname} belum diatur. Isi nomornya di tab Pengaturan.`,
      });
      setTab("settings");
      return;
    }

    const payables = data?.payables ?? [];
    const invoices = payables.filter((p) => p.outstanding > 0).map(toInvoiceLine);

    openWhatsAppDialog({
      mode: "INTERNAL",
      recipientName: recipient.fullname,
      phone,
      invoices,
      message: buildInternalMessage(payables, recipient.fullname),
    });
  }

  function sendManualWhatsApp() {
    if (!waTarget) return;

    const phone = normalizePhone(waPhone);

    if (!phone || phone.length < 9 || phone.length > 15) {
      setNotice({
        type: "error",
        text: "Masukkan nomor WhatsApp yang valid. Contoh: 628123456789.",
      });
      return;
    }

    if (!waMessage.trim()) {
      setNotice({
        type: "error",
        text: "Isi pesan tidak boleh kosong.",
      });
      return;
    }

    const url = new URL("https://web.whatsapp.com/send");
    url.searchParams.set("phone", phone);
    url.searchParams.set("text", waMessage);

    window.open(url.toString(), "_blank", "noopener,noreferrer");

    const name = waTarget.recipientName;
    setWaTarget(null);

    setNotice({
      type: "success",
      text: `WhatsApp Web dibuka untuk ${name}. Periksa penerima dan isi pesan, lalu tekan Kirim di WhatsApp Web.`,
    });
  }

  async function copyMessage() {
    const ok = await copyText(waMessage, "Pesan berhasil disalin.");
    if (ok) setCopiedMessage(true);
  }

  const summary = data?.summary;

  const tabs = [
    { id: "payables", label: "Daftar hutang", icon: WalletCards },
    { id: "history", label: "Riwayat pengingat", icon: BellRing },
    { id: "settings", label: "Pengaturan", icon: Settings2 },
  ] as const;

  return (
    <main className="min-h-screen bg-[#f4f7f6] px-3 py-4 text-slate-800 dark:bg-[#0b1220] dark:text-slate-100 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#102e28] via-[#17483c] to-[#497f70] p-5 text-white shadow-xl shadow-emerald-950/10 sm:rounded-[30px] sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-5 -top-12 h-56 w-56 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute bottom-[-110px] left-[42%] h-64 w-64 rounded-full bg-white/[0.04] blur-2xl" />

          <div className="relative flex flex-col justify-between gap-7 xl:flex-row xl:items-end">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-emerald-50 sm:text-xs">
                <ShieldCheck size={15} />
                FINANCE CONTROL CENTER
              </div>

              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                Pengingat Pembayaran Hutang
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80 sm:text-base">
                Kontrol kewajiban pembayaran supplier, konfirmasi invoice,
                dan rekap internal Finance/Management dalam satu pusat kontrol.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-white/85">
                  <CalendarClock size={13} />
                  Asia/Jakarta
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-white/85">
                  <FileText size={13} />
                  PurchasePayable
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/20 bg-emerald-300/15 px-3 py-1.5 font-semibold text-emerald-50">
                  <MessageCircle size={13} />
                  WhatsApp Web · Manual
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                onClick={() => void load()}
                disabled={loading || checking}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/15 disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Segarkan
              </button>

              <button
                onClick={() => void runCheck()}
                disabled={checking || loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#173d33] shadow-lg transition hover:bg-emerald-50 disabled:opacity-50"
              >
                <BellRing size={16} className={checking ? "animate-pulse" : ""} />
                {checking ? "Memeriksa..." : "Periksa sekarang"}
              </button>
            </div>
          </div>
        </section>

        {notice && (
          <div
            role="status"
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
            }`}
          >
            {notice.type === "success" ? (
              <Check size={18} className="mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            )}
            <span className="flex-1 leading-6">{notice.text}</span>
            <button
              onClick={() => setNotice(null)}
              aria-label="Tutup pesan"
              className="rounded-lg p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            title="Total sisa hutang"
            value={IDR(summary?.totalOutstanding ?? 0)}
            detail={`${summary?.openPayables ?? 0} tagihan belum lunas`}
            icon={<CircleDollarSign size={20} />}
            tone="emerald"
          />
          <Kpi
            title="Sudah terlambat"
            value={String(summary?.overdueCount ?? 0)}
            detail="Tagihan melewati jatuh tempo"
            icon={<AlertTriangle size={20} />}
            tone="rose"
          />
          <Kpi
            title="Jatuh tempo hari ini"
            value={String(summary?.dueTodayCount ?? 0)}
            detail="Perlu ditinjau hari ini"
            icon={<CalendarClock size={20} />}
            tone="amber"
          />
          <Kpi
            title="7 hari ke depan"
            value={String(summary?.next7DaysCount ?? 0)}
            detail={`${summary?.unreadReminders ?? 0} pengingat belum dibaca`}
            icon={<BellRing size={20} />}
            tone="blue"
          />
        </section>

        <section className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-3 dark:border-slate-800 sm:p-5">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                  Manajemen tagihan
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                  Pantau kewajiban MGB dan siapkan pesan konfirmasi pembayaran.
                </p>
              </div>

              {tab === "payables" && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Cari supplier / invoice..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 sm:w-64"
                    />
                  </div>

                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="ALL">Semua tagihan</option>
                    <option value="OVERDUE">Terlambat</option>
                    <option value="TODAY">Jatuh tempo hari ini</option>
                    <option value="NEXT7">7 hari ke depan</option>
                    <option value="NO_DATE">Tanpa tanggal tempo</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    tab === id
                      ? "bg-[#e6f1ed] text-[#1c5948] dark:bg-orange-500/15 dark:text-orange-300"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                  {id === "history" && (summary?.unreadReminders ?? 0) > 0 && (
                    <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {summary?.unreadReminders}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {tab === "payables" && (
            <>
              <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-5">
                <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <Users size={19} className="text-emerald-700 dark:text-orange-300" />
                      <h3 className="font-bold text-slate-900 dark:text-slate-100">
                        Rekap internal Finance / Management
                      </h3>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      Gabungkan seluruh invoice terbuka dari semua supplier menjadi
                      satu laporan internal, lengkap dengan total dan prioritas tempo.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={selectedInternalRecipient}
                      onChange={(e) => setSelectedInternalRecipient(e.target.value)}
                      className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 sm:min-w-56"
                    >
                      <option value="">Pilih penerima internal</option>
                      {recipients.map((r) => (
                        <option key={r.id} value={String(r.id)}>
                          {r.fullname} · {r.role}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={openInternalSummary}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#18352d] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#254b40] dark:bg-orange-600 dark:hover:bg-orange-500"
                    >
                      <Send size={15} />
                      Siapkan rekap
                    </button>

                    <button
                      onClick={() => {
                        const recipient = recipients.find(
                          (r) => String(r.id) === selectedInternalRecipient
                        );
                        const message = buildInternalMessage(
                          data?.payables ?? [],
                          recipient?.fullname || "Finance / Management"
                        );
                        void copyText(message, "Rekap internal berhasil disalin.");
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Copy size={15} />
                      Salin rekap semua
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Menampilkan{" "}
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {filteredPayables.length}
                  </span>{" "}
                  tagihan
                </p>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <MessageCircle size={13} />
                  Invoice supplier yang sama digabung otomatis
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] text-left text-sm">
                  <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-4 font-bold">Supplier / Tagihan</th>
                      <th className="px-4 py-4 font-bold">Sumber</th>
                      <th className="px-4 py-4 font-bold">Jatuh tempo</th>
                      <th className="px-4 py-4 text-right font-bold">Total</th>
                      <th className="px-4 py-4 text-right font-bold">Terbayar</th>
                      <th className="px-5 py-4 text-right font-bold">Sisa hutang</th>
                      <th className="px-5 py-4 text-right font-bold">Tindakan</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {loading ? (
                      <TableMessage text="Memuat data hutang..." />
                    ) : filteredPayables.length === 0 ? (
                      <TableMessage text="Tidak ada tagihan sesuai filter." />
                    ) : (
                      filteredPayables.map((p) => {
                        const key = p.supplierName.trim().toLocaleLowerCase("id-ID");
                        const group = supplierGroups.find(
                          (item) => item.supplierName.toLocaleLowerCase("id-ID") === key
                        );
                        const copied = copiedInvoiceId === p.id;

                        return (
                          <tr
                            key={p.id}
                            className="transition hover:bg-emerald-50/40 dark:hover:bg-slate-800/50"
                          >
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {p.supplierName}
                              </div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {p.invoiceNumber} <span className="px-1">·</span> ID {p.id}
                              </div>
                              {group && group.invoices.length > 1 && (
                                <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                  {group.invoices.length} invoice akan digabung
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-4">
                              <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                {p.source}
                              </span>
                            </td>

                            <td className="px-4 py-4">
                              <div className="font-medium">{DATE(p.dueDate)}</div>
                              <span
                                className={`mt-1 inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${statusTone(p.status)}`}
                              >
                                {dueLabel(p.daysLeft)}
                              </span>
                            </td>

                            <td className="px-4 py-4 text-right tabular-nums text-slate-500 dark:text-slate-400">
                              {IDR(p.amount)}
                            </td>

                            <td className="px-4 py-4 text-right tabular-nums text-slate-500 dark:text-slate-400">
                              {IDR(p.paidAmount)}
                            </td>

                            <td className="px-5 py-4 text-right">
                              <div className="font-bold tabular-nums text-slate-900 dark:text-orange-300">
                                {IDR(p.outstanding)}
                              </div>
                              <Link
                                href="/purchase-payable"
                                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#497f70] hover:underline dark:text-orange-300"
                              >
                                Detail hutang <ChevronRight size={13} />
                              </Link>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex flex-wrap justify-end gap-2">
                                <button
                                  onClick={() => void copySupplierMessage(p)}
                                  disabled={p.outstanding <= 0}
                                  title="Salin pesan WhatsApp supplier"
                                  className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  {copied ? <Check size={14} /> : <Copy size={14} />}
                                  {copied ? "Tersalin" : "Salin pesan"}
                                </button>

                                <button
                                  onClick={() => openFromPayable(p)}
                                  disabled={p.outstanding <= 0}
                                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#18352d] px-3 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#254b40] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                                >
                                  <WhatsAppIcon size={15} />
                                  Buka WhatsApp
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

              {supplierGroups.length > 0 && (
                <div className="border-t border-slate-100 p-4 dark:border-slate-800 sm:p-5">
                  <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100">
                        Pesan gabungan per supplier
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Salin pesan untuk satu supplier atau semua supplier sekaligus.
                      </p>
                    </div>

                    <button
                      onClick={() => void copyAllSupplierMessages()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
                    >
                      {copiedSupplierKey === "ALL" ? <Check size={15} /> : <Copy size={15} />}
                      {copiedSupplierKey === "ALL" ? "Semua pesan tersalin" : "Salin pesan semua supplier"}
                    </button>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-2">
                    {supplierGroups.map((group) => {
                      const key = group.supplierName.toLocaleLowerCase("id-ID");
                      const copied = copiedSupplierKey === key;

                      return (
                        <div
                          key={key}
                          className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                        >
                          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 dark:text-slate-100">
                                {group.supplierName}
                              </p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {group.invoices.length} invoice terbuka
                              </p>
                              <p className="mt-2 text-lg font-bold text-emerald-800 dark:text-orange-300">
                                {IDR(group.total)}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => {
                                  const message = buildSupplierMessage(
                                    group.supplierName,
                                    group.invoices
                                  );
                                  void copyText(
                                    message,
                                    `Pesan untuk ${group.supplierName} berhasil disalin.`
                                  ).then((ok) => {
                                    if (ok) setCopiedSupplierKey(key);
                                  });
                                }}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? "Tersalin" : "Salin pesan"}
                              </button>

                              <button
                                onClick={() =>
                                  openWhatsAppDialog({
                                    mode: "SUPPLIER",
                                    recipientName: group.supplierName,
                                    supplierName: group.supplierName,
                                    phone: group.phone,
                                    invoices: group.invoices,
                                    message: buildSupplierMessage(
                                      group.supplierName,
                                      group.invoices
                                    ),
                                  })
                                }
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#18352d] px-3 py-2 text-xs font-bold text-white hover:bg-[#254b40] dark:bg-emerald-700 dark:hover:bg-emerald-600"
                              >
                                <MessageCircle size={14} />
                                WhatsApp
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 space-y-2">
                            {group.invoices.map((invoice) => (
                              <div
                                key={invoice.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-950"
                              >
                                <div>
                                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                                    {invoice.invoiceNumber}
                                  </p>
                                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                                    Tempo {DATE(invoice.dueDate)} · {dueLabel(invoice.daysLeft)}
                                  </p>
                                </div>
                                <p className="font-bold tabular-nums text-slate-900 dark:text-orange-300">
                                  {IDR(invoice.outstanding)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "history" && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {(data?.reminders ?? []).length === 0 ? (
                <div className="p-12 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                    <BellRing size={25} />
                  </div>
                  <p className="font-semibold">Belum ada riwayat pengingat</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Gunakan Periksa sekarang untuk memeriksa tagihan.
                  </p>
                </div>
              ) : (
                data?.reminders.map((r) => (
                  <div
                    key={r.id}
                    className={`flex flex-col gap-4 px-4 py-4 transition sm:px-5 ${
                      r.readAt ? "" : "bg-emerald-50/50 dark:bg-emerald-950/10"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                          r.stage === "OVERDUE"
                            ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        }`}
                      >
                        <BellRing size={18} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{r.supplierName}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusTone(r.stage)}`}>
                            {stageLabel(r.stage)}
                          </span>
                          {!r.readAt && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              BARU
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          {r.invoiceNumber} · Sisa {IDR(r.outstanding)} · Tempo {DATE(r.dueDate)}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(r.createdAt).toLocaleString("id-ID", {
                            timeZone: "Asia/Jakarta",
                          })}
                        </p>

                        {r.whatsappError && (
                          <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">
                            Catatan status WhatsApp sebelumnya: {r.whatsappError}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(r.whatsappStatus)}`}>
                          {r.whatsappStatus === "SENT"
                            ? "Status lama: terkirim"
                            : r.whatsappStatus === "FAILED"
                              ? "Status lama: gagal"
                              : "Belum ada konfirmasi"}
                        </span>

                        {!r.readAt && (
                          <button
                            onClick={() => void markRead(r)}
                            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800"
                            title="Tandai dibaca"
                          >
                            <CheckCheck size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <button
                        onClick={() => {
                          const invoice = data?.payables.find((p) => p.id === r.payableId);
                          const lines = invoice ? [toInvoiceLine(invoice)] : [{
                            id: r.payableId,
                            invoiceNumber: r.invoiceNumber,
                            source: r.source,
                            invoiceDate: null,
                            dueDate: r.dueDate || null,
                            daysLeft: null,
                            amount: r.outstanding,
                            paidAmount: 0,
                            outstanding: r.outstanding,
                          }];
                          void copyText(
                            buildSupplierMessage(r.supplierName, lines),
                            `Pesan konfirmasi untuk ${r.supplierName} berhasil disalin.`
                          );
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Copy size={15} />
                        Salin pesan supplier
                      </button>

                      <button
                        onClick={() => openFromReminder(r)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#18352d] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#254b40] dark:bg-emerald-700 dark:hover:bg-emerald-600"
                      >
                        <WhatsAppIcon size={15} />
                        Siapkan pesan supplier
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "settings" && (
            <div className="p-4 sm:p-6">
              <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    <MessageCircle size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-950 dark:text-emerald-200">
                      WhatsApp Web — pengiriman manual
                    </p>
                    <p className="mt-1 text-sm leading-6 text-emerald-900/80 dark:text-emerald-200/80">
                      Sistem menyiapkan nomor dan pesan. Pengguna tetap memeriksa
                      isi pesan dan menekan Kirim sendiri. Tidak membutuhkan Cloud
                      API, access token, atau template Meta.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="flex items-start gap-3">
                  <Phone size={19} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Perbedaan nomor penerima</p>
                    <p className="mt-1 text-sm leading-5">
                      Nomor di bagian ini adalah nomor penerima internal ERP.
                      Nomor supplier berasal dari data supplier atau tagihan.
                      Nomor internal tidak otomatis digunakan sebagai nomor supplier.
                    </p>
                  </div>
                </div>
              </div>

              {!canEditRecipients && (
                <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                  Hanya ADMIN yang dapat mengubah nomor penerima notifikasi.
                </p>
              )}

              <div className="mb-4">
                <h3 className="font-bold text-slate-900 dark:text-slate-100">
                  Penerima notifikasi ERP
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Gunakan nomor Finance atau Management untuk mengirim rekap internal.
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {recipients.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-slate-200 p-4 transition hover:border-emerald-200 dark:border-slate-800 dark:hover:border-emerald-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{r.fullname}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {r.username} · {r.role}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        PENERIMA INTERNAL
                      </span>
                    </div>

                    <label className="mt-4 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Nomor WhatsApp
                    </label>

                    <div className="mt-1.5 flex gap-2">
                      <input
                        disabled={!canEditRecipients}
                        value={r.whatsappPhone ?? ""}
                        onChange={(e) =>
                          setRecipients((old) =>
                            old.map((item) =>
                              item.id === r.id
                                ? { ...item, whatsappPhone: e.target.value }
                                : item
                            )
                          )
                        }
                        placeholder="62812xxxxxxxx"
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950"
                      />

                      {canEditRecipients && (
                        <button
                          disabled={savingPhone === r.id}
                          onClick={() => void savePhone(r)}
                          className="inline-flex items-center justify-center rounded-xl bg-[#18352d] px-4 text-white transition hover:bg-[#254b40] disabled:opacity-50 dark:bg-orange-600 dark:hover:bg-orange-500"
                          title="Simpan nomor"
                        >
                          {savingPhone === r.id ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <Check size={17} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {recipients.length === 0 && !loading && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400 lg:col-span-2">
                    Belum ada data penerima notifikasi ERP.
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <div className="flex flex-col justify-between gap-3 px-1 text-xs text-slate-400 sm:flex-row sm:items-center">
          <p>
            Data saldo tetap mengacu pada PurchasePayable. Menyalin pesan atau
            membuka WhatsApp tidak mengubah transaksi maupun status pembayaran.
          </p>

          <Link
            href="/purchase-payable"
            className="inline-flex items-center gap-1 self-start font-semibold text-[#497f70] hover:underline dark:text-orange-300 sm:self-auto"
          >
            Buka modul hutang <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>

      {waTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setWaTarget(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="wa-dialog-title"
            className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[26px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:max-h-[90dvh] sm:rounded-[26px]"
          >
            <div className="relative overflow-hidden bg-gradient-to-r from-[#102e28] to-[#497f70] px-5 py-5 text-white sm:px-6">
              <div className="pointer-events-none absolute -right-8 -top-14 h-40 w-40 rounded-full border border-white/10" />

              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                    {waTarget.mode === "INTERNAL" ? (
                      <Users size={22} />
                    ) : (
                      <MessageCircle size={22} />
                    )}
                  </div>

                  <div>
                    <div className="mb-1 inline-flex rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-emerald-50">
                      {waTarget.mode === "INTERNAL" ? "LAPORAN INTERNAL" : "KONFIRMASI SUPPLIER"}
                    </div>
                    <h2 id="wa-dialog-title" className="text-lg font-bold">
                      {waTarget.mode === "INTERNAL"
                        ? "Rekap Finance / Management"
                        : "Konfirmasi kewajiban pembayaran"}
                    </h2>
                    <p className="mt-1 text-sm text-emerald-50/80">
                      Tinjau atau salin pesan sebelum membuka WhatsApp Web.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setWaTarget(null)}
                  aria-label="Tutup dialog"
                  className="rounded-xl border border-white/15 bg-white/10 p-2 transition hover:bg-white/20"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Penerima
                  </p>
                  <p className="mt-1 break-words font-bold text-slate-900 dark:text-slate-100">
                    {waTarget.recipientName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {waTarget.mode === "INTERNAL" ? "Finance / Management" : "Supplier"}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                    Total sisa kewajiban
                  </p>
                  <p className="mt-1 break-words text-lg font-bold text-emerald-950 dark:text-orange-300">
                    {IDR(
                      waTarget.invoices.reduce(
                        (sum, invoice) => sum + invoice.outstanding,
                        0
                      )
                    )}
                  </p>
                  <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/80">
                    {waTarget.invoices.length} invoice
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/25">
                  <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
                    Jenis pesan
                  </p>
                  <p className="mt-1 font-bold text-blue-950 dark:text-blue-200">
                    {waTarget.mode === "INTERNAL" ? "Rekap seluruh supplier" : "Konfirmasi invoice"}
                  </p>
                  <p className="mt-1 text-xs text-blue-800/80 dark:text-blue-300/80">
                    {waTarget.mode === "INTERNAL" ? "Internal MGB" : "Kewajiban MGB"}
                  </p>
                </div>
              </div>

              {waTarget.mode === "SUPPLIER" && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3 dark:bg-slate-950">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Rincian invoice yang digabung
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Saldo terbuka yang tercatat sebagai kewajiban MGB.
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {waTarget.invoices.length} invoice
                    </span>
                  </div>

                  <div className="max-h-48 overflow-auto">
                    <table className="w-full min-w-[500px] text-left text-xs">
                      <thead className="sticky top-0 bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Invoice</th>
                          <th className="px-4 py-3">Jatuh tempo</th>
                          <th className="px-4 py-3 text-right">Sisa kewajiban</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {waTarget.invoices.map((invoice) => (
                          <tr key={invoice.id}>
                            <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                              {invoice.invoiceNumber}
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                              <div>{DATE(invoice.dueDate)}</div>
                              <div className="mt-1">{dueLabel(invoice.daysLeft)}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900 dark:text-orange-300">
                              {IDR(invoice.outstanding)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="wa-phone"
                  className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  Nomor WhatsApp penerima
                </label>

                <div className="relative">
                  <Phone
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="wa-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    placeholder="Contoh: 628123456789"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>

                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Gunakan kode negara 62 untuk nomor Indonesia. Nomor dinormalisasi
                  sebelum WhatsApp Web dibuka.
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label
                    htmlFor="wa-message"
                    className="text-sm font-semibold text-slate-800 dark:text-slate-200"
                  >
                    Isi pesan
                  </label>

                  <button
                    onClick={() => {
                      if (waTarget.mode === "INTERNAL") {
                        setWaMessage(
                          buildInternalMessage(
                            data?.payables ?? [],
                            waTarget.recipientName
                          )
                        );
                      } else {
                        setWaMessage(
                          buildSupplierMessage(
                            waTarget.supplierName || waTarget.recipientName,
                            waTarget.invoices
                          )
                        );
                      }
                    }}
                    className="text-xs font-semibold text-[#497f70] hover:underline dark:text-orange-300"
                  >
                    Pulihkan pesan awal
                  </button>
                </div>

                <textarea
                  id="wa-message"
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  rows={15}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                />

                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400">
                  <span>Pesan dapat diedit sebelum disalin atau dikirim manual.</span>
                  <span>{waMessage.length} karakter</span>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                WhatsApp Web hanya dibuka dengan nomor dan pesan yang disiapkan.
                ERP tidak mengirim pesan otomatis. Periksa kembali penerima dan
                rincian kewajiban sebelum menekan Kirim.
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <button
                onClick={() => void copyMessage()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {copiedMessage ? <Check size={16} /> : <Copy size={16} />}
                {copiedMessage ? "Pesan tersalin" : "Salin pesan WhatsApp"}
              </button>

              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button
                  onClick={() => setWaTarget(null)}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Batal
                </button>

                <button
                  onClick={sendManualWhatsApp}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#18352d] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/10 transition hover:bg-[#254b40] active:scale-[0.98] dark:bg-emerald-700 dark:hover:bg-emerald-600"
                >
                  <Send size={16} />
                  Buka WhatsApp Web
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
