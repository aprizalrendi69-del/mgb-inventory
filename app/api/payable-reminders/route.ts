import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["ADMIN", "MANAGER", "PURCHASING"] as const;
const REMINDER_DAYS = new Map<number, string>([
  [7, "H-7"],
  [3, "H-3"],
  [1, "H-1"],
  [0, "DUE"],
]);

type AppUser = {
  id: number;
  username: string;
  fullname: string;
  role: string;
  active: boolean;
  whatsappPhone?: string | null;
};

async function getCurrentUser(): Promise<AppUser | null> {
  const store = await cookies();
  const token = store.get("erp-session")?.value ?? store.get("session")?.value;
  if (!token) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { token },
      select: {
        expiresAt: true,
        user: {
          select: {
            id: true, username: true, fullname: true, role: true,
            active: true, whatsappPhone: true,
          },
        },
      },
    });
    if (session) {
      if (session.expiresAt <= new Date() || !session.user.active) return null;
      return session.user;
    }
  } catch {
    // Cookie JSON lama tetap didukung sebagai fallback.
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(token));
    const id = Number(parsed?.user?.id ?? parsed?.data?.user?.id ?? parsed?.data?.id ?? parsed?.id);
    if (!Number.isInteger(id) || id <= 0) return null;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, fullname: true, role: true,
        active: true, whatsappPhone: true,
      },
    });
    return user?.active ? user : null;
  } catch {
    return null;
  }
}

function dateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function money(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

async function sendWhatsAppTemplate(phone: string, params: string[]) {
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID?.trim();
  const token = process.env.WA_ACCESS_TOKEN?.trim();
  const templateName = process.env.WA_PAYABLE_TEMPLATE_NAME?.trim();
  const language = process.env.WA_PAYABLE_TEMPLATE_LANGUAGE?.trim() || "id";
  const graphApiVersion = process.env.WA_GRAPH_API_VERSION?.trim() || "v23.0";

  if (!phoneNumberId || !token || !templateName) {
    return { status: "SKIPPED", error: "Konfigurasi WhatsApp Cloud API/template belum lengkap." };
  }

  const normalizedPhone = phone.replace(/[^\d]/g, "").replace(/^0/, "62");
  if (normalizedPhone.length < 9) {
    return { status: "SKIPPED", error: "Nomor WhatsApp penerima belum valid." };
  }

  const response = await fetch(`https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizedPhone,
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        components: [{
          type: "body",
          parameters: params.map((text) => ({ type: "text", text })),
        }],
      },
    }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = body?.error?.message || `WhatsApp API HTTP ${response.status}`;
    return { status: "FAILED", error: String(error).slice(0, 500) };
  }
  return { status: "SENT", error: null as string | null };
}

function resolveStage(daysLeft: number): string | null {
  if (REMINDER_DAYS.has(daysLeft)) return REMINDER_DAYS.get(daysLeft)!;
  if (daysLeft < 0) return "OVERDUE";
  return null;
}

/**
 * Checks due payables and creates one ERP reminder per recipient/stage/due date.
 * This is idempotent: a repeated scheduler call cannot duplicate the same reminder.
 */
async function runReminderCheck() {
  const now = new Date();
  const todayKey = dateKey(now);
  const todayNumber = dayNumber(todayKey);

  const [payables, recipients] = await Promise.all([
    prisma.purchasePayable.findMany({
      where: { status: { notIn: ["PAID", "LUNAS", "VOID", "CANCELLED"] } },
      include: {
        supplier: { select: { id: true, name: true, tempoDays: true } },
        purchase: { select: { number: true } },
        outletPurchase: {
          select: { number: true, outlet: { select: { name: true } } },
        },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.user.findMany({
      where: { active: true, role: { in: [...ALLOWED_ROLES] } },
      select: { id: true, fullname: true, role: true, whatsappPhone: true },
    }),
  ]);

  let scanned = 0;
  let created = 0;
  let whatsappSent = 0;
  let whatsappFailed = 0;
  let skipped = 0;

  for (const payable of payables) {
    const amount = Number(payable.amount ?? 0);
    const paidAmount = Number(payable.paidAmount ?? 0);
    const storedOutstanding = Number(payable.outstanding ?? 0);
    // Prefer the live amount-minus-paid calculation, while respecting stored outstanding.
    const calculatedOutstanding = Math.max(0, amount - paidAmount);
    const outstanding = Math.max(0, Math.min(
      Number.isFinite(storedOutstanding) ? storedOutstanding : calculatedOutstanding,
      calculatedOutstanding,
    ));

    if (!Number.isFinite(outstanding) || outstanding <= 0) continue;

    let dueDate = payable.dueDate;
    if (!dueDate && payable.invoiceDate && payable.supplier?.tempoDays != null) {
      dueDate = addDays(payable.invoiceDate, Number(payable.supplier.tempoDays));
    }
    if (!dueDate) continue;

    scanned += 1;
    const dueKey = dateKey(dueDate);
    const daysLeft = dayNumber(dueKey) - todayNumber;
    const stage = resolveStage(daysLeft);
    if (!stage) continue;

    const supplierName = payable.supplier?.name ?? "Supplier";
    const invoiceNumber = payable.invoiceNumber || payable.purchase?.number ||
      payable.outletPurchase?.number || `PAYABLE-${payable.id}`;
    const source = payable.outletPurchase
      ? `Outlet ${payable.outletPurchase.outlet?.name ?? ""}`.trim()
      : "Pusat";
    const dueLabel = formatDate(dueKey);
    const timing = stage === "OVERDUE"
      ? `terlambat ${Math.abs(daysLeft)} hari`
      : stage === "DUE" ? "jatuh tempo hari ini" : `jatuh tempo ${daysLeft} hari lagi`;
    const message = `Pengingat hutang ${stage}: ${supplierName}, invoice ${invoiceNumber}, sisa ${money(outstanding)}, jatuh tempo ${dueLabel} (${timing}). Sumber: ${source}.`;

    for (const recipient of recipients) {
      let log = await prisma.payableReminderLog.findFirst({
        where: { payableId: payable.id, userId: recipient.id, stage, dueDate },
      });

      if (!log) {
        try {
          log = await prisma.payableReminderLog.create({
            data: {
              payableId: payable.id,
              userId: recipient.id,
              dueDate,
              stage,
              source,
              supplierName,
              invoiceNumber,
              outstanding,
              message,
            },
          });
          created += 1;
        } catch (error: any) {
          if (error?.code !== "P2002") throw error;
          // A concurrent scheduler may have inserted the same reminder.
          log = await prisma.payableReminderLog.findFirst({
            where: { payableId: payable.id, userId: recipient.id, stage, dueDate },
          });
        }
      }

      if (!log || log.whatsappStatus === "SENT") continue;

      try {
        const result = await sendWhatsAppTemplate(
          recipient.whatsappPhone ?? "",
          [recipient.fullname || recipient.role, supplierName, invoiceNumber, money(outstanding), dueLabel, stage],
        );
        await prisma.payableReminderLog.update({
          where: { id: log.id },
          data: {
            whatsappStatus: result.status,
            whatsappSentAt: result.status === "SENT" ? new Date() : null,
            whatsappError: result.error,
          },
        });
        if (result.status === "SENT") whatsappSent += 1;
        else if (result.status === "FAILED") whatsappFailed += 1;
        else skipped += 1;
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown WhatsApp error";
        await prisma.payableReminderLog.update({
          where: { id: log.id },
          data: { whatsappStatus: "FAILED", whatsappError: detail.slice(0, 500) },
        });
        whatsappFailed += 1;
      }
    }
  }

  return { today: todayKey, scannedPayables: scanned, createdReminders: created, whatsappSent, whatsappFailed, whatsappSkipped: skipped };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    const [payables, logs] = await Promise.all([
      prisma.purchasePayable.findMany({
        where: { status: { notIn: ["PAID", "LUNAS", "VOID", "CANCELLED"] } },
        include: {
          supplier: { select: { name: true, tempoDays: true } },
          purchase: { select: { number: true } },
          outletPurchase: { select: { number: true, outlet: { select: { name: true } } } },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      }),
      prisma.payableReminderLog.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true, payableId: true, stage: true, supplierName: true, invoiceNumber: true,
          outstanding: true, dueDate: true, source: true, message: true, createdAt: true,
          readAt: true, whatsappStatus: true, whatsappSentAt: true, whatsappError: true,
        },
      }),
    ]);

    const todayKey = dateKey(new Date());
    const todayNumber = dayNumber(todayKey);
    const formatted = payables.map((p) => {
      const amount = Number(p.amount ?? 0);
      const paidAmount = Number(p.paidAmount ?? 0);
      const outstanding = Math.max(0, Math.min(Number(p.outstanding ?? 0), Math.max(0, amount - paidAmount)));
      let due = p.dueDate;
      if (!due && p.invoiceDate && p.supplier?.tempoDays != null) due = addDays(p.invoiceDate, Number(p.supplier.tempoDays));
      const dueKey = due ? dateKey(due) : null;
      const daysLeft = dueKey ? dayNumber(dueKey) - todayNumber : null;
      return {
        id: p.id,
        supplierName: p.supplier?.name ?? "Supplier",
        invoiceNumber: p.invoiceNumber || p.purchase?.number || p.outletPurchase?.number || `PAYABLE-${p.id}`,
        source: p.outletPurchase ? (p.outletPurchase.outlet?.name ?? "Outlet") : "Pusat",
        invoiceDate: p.invoiceDate,
        dueDate: due,
        dueDateKey: dueKey,
        daysLeft,
        amount,
        paidAmount,
        outstanding,
        status: outstanding <= 0 ? "LUNAS" : daysLeft == null ? "TANPA_TANGGAL" : daysLeft < 0 ? "TERLAMBAT" : daysLeft <= 3 ? "SEGERA" : daysLeft <= 7 ? "MENDATANG" : "BELUM_DEKAT",
      };
    }).filter((p) => p.outstanding > 0);

    const open = formatted.length;
    return NextResponse.json({
      ok: true,
      today: todayKey,
      summary: {
        openPayables: open,
        totalOutstanding: formatted.reduce((s, p) => s + p.outstanding, 0),
        overdueCount: formatted.filter((p) => p.daysLeft != null && p.daysLeft < 0).length,
        dueTodayCount: formatted.filter((p) => p.daysLeft === 0).length,
        next7DaysCount: formatted.filter((p) => p.daysLeft != null && p.daysLeft >= 0 && p.daysLeft <= 7).length,
        unreadReminders: logs.filter((l) => !l.readAt).length,
      },
      payables: formatted,
      reminders: logs,
      whatsappConfigured: Boolean(process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN && process.env.WA_PAYABLE_TEMPLATE_NAME),
    });
  } catch (error) {
    console.error("[GET /api/payable-reminders]", error);
    return NextResponse.json({ error: "Gagal memuat pengingat hutang." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.PAYABLE_REMINDER_CRON_SECRET?.trim();
    const suppliedSecret = request.headers.get("x-cron-secret") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const authorizedByCron = Boolean(cronSecret && suppliedSecret && suppliedSecret === cronSecret);

    if (!authorizedByCron) {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (!["ADMIN", "MANAGER"].includes(user.role)) {
        return NextResponse.json({ error: "Hanya ADMIN/MANAGER atau scheduler berizin." }, { status: 403 });
      }
    }

    const result = await runReminderCheck();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[POST /api/payable-reminders]", error);
    return NextResponse.json({ ok: false, error: "Pemeriksaan pengingat hutang gagal." }, { status: 500 });
  }
}
