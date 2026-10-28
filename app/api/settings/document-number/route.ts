import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const defaults = [
  { type: "purchase", prefix: "PO" },
  { type: "goods-receipt", prefix: "GR" },
  { type: "delivery-order", prefix: "DO" },
  { type: "surat-jalan", prefix: "SJ" },
] as const;
const periodNow = () => { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).formatToParts(new Date()); const year = parts.find((part) => part.type === "year")?.value ?? "0000"; const month = parts.find((part) => part.type === "month")?.value ?? "00"; return `${year}${month}`; };
async function authorized() {
  const store = await cookies(); const raw = store.get("erp-session")?.value;
  if (!raw) return false;
  try { const session = JSON.parse(raw) as { id?: number }; if (!session.id) return false;
    const user = await prisma.user.findUnique({ where: { id: Number(session.id) }, select: { role: true, active: true } });
    return !!user?.active && ["ADMIN", "MANAGER"].includes(user.role);
  } catch { return false; }
}
export async function GET() {
  try {
    if (!await authorized()) return NextResponse.json({ success:false, message:"Tidak memiliki akses." }, { status:401 });
    const period = periodNow(); const rows = await prisma.documentNumber.findMany({ where: { period } });
    const data = defaults.map((item) => ({ ...item, prefix: rows.find((r)=>r.type===item.type)?.prefix ?? item.prefix }));
    return NextResponse.json({ success:true, period, data }, { headers:{ "Cache-Control":"no-store" } });
  } catch (error) { console.error("DOCUMENT_NUMBER_GET_ERROR", error); return NextResponse.json({ success:false, message:"Gagal membaca konfigurasi nomor dokumen." }, { status:500 }); }
}
export async function PUT(request: NextRequest) {
  try {
    if (!await authorized()) return NextResponse.json({ success:false, message:"Tidak memiliki akses." }, { status:403 });
    const body = await request.json() as { documents?: unknown };
    if (!Array.isArray(body.documents)) return NextResponse.json({ success:false, message:"Daftar konfigurasi tidak valid." }, { status:400 });
    const period = periodNow();
    const byType = new Map<string,string>();
    for (const raw of body.documents) {
      if (!raw || typeof raw !== "object") return NextResponse.json({ success:false, message:"Format konfigurasi tidak valid." }, { status:400 });
      const item = raw as { id?: unknown; prefix?: unknown };
      if (typeof item.id !== "string" || !defaults.some((d)=>d.type===item.id)) return NextResponse.json({ success:false, message:"Jenis dokumen tidak dikenal." }, { status:400 });
      if (typeof item.prefix !== "string" || !/^[A-Z0-9]{1,10}$/.test(item.prefix)) return NextResponse.json({ success:false, message:"Prefix harus 1–10 karakter huruf kapital atau angka." }, { status:400 });
      byType.set(item.id,item.prefix);
    }
    if (byType.size !== defaults.length) return NextResponse.json({ success:false, message:"Semua jenis dokumen wajib dikirim." }, { status:400 });
    const data = await prisma.$transaction(async (tx) => {
      for (const item of defaults) {
        const prefix = byType.get(item.type)!;
        await tx.documentNumber.upsert({ where: { type_period: { type:item.type, period } }, create: { type:item.type, prefix, period, lastNumber:0 }, update: { prefix } });
      }
      return tx.documentNumber.findMany({ where:{ period }, orderBy:{ type:"asc" } });
    });
    return NextResponse.json({ success:true, period, data });
  } catch (error) { console.error("DOCUMENT_NUMBER_PUT_ERROR", error); return NextResponse.json({ success:false, message:"Gagal menyimpan konfigurasi nomor dokumen." }, { status:500 }); }
}
