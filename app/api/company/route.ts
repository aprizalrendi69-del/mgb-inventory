import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const editableFields = ["name", "logo", "address", "city", "province", "postalCode", "phone", "email", "website", "npwp", "director", "footer"] as const;
type EditableField = (typeof editableFields)[number];

async function currentUser() {
  const store = await cookies();
  const cookie = store.get("erp-session");
  if (!cookie?.value) return null;
  try {
    const session = JSON.parse(cookie.value) as { id?: number };
    if (!session.id) return null;
    return await prisma.user.findUnique({ where: { id: Number(session.id) }, select: { id: true, role: true, active: true } });
  } catch { return null; }
}

export async function GET() {
  try {
    const user = await currentUser();
    if (!user?.active) return NextResponse.json({ success: false, message: "Silakan login kembali." }, { status: 401 });
    let company = await prisma.company.findFirst({ orderBy: { id: "asc" } });
    if (!company) company = await prisma.company.create({ data: { name: "PT. Mitra Garam Bogatama" } });
    return NextResponse.json({ success: true, data: company }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("COMPANY_GET_ERROR", error);
    return NextResponse.json({ success: false, message: "Gagal mengambil profil perusahaan." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user?.active) return NextResponse.json({ success: false, message: "Silakan login kembali." }, { status: 401 });
    if (!["ADMIN", "MANAGER"].includes(user.role)) return NextResponse.json({ success: false, message: "Anda tidak memiliki akses mengubah profil perusahaan." }, { status: 403 });
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, message: "Format data tidak valid." }, { status: 400 });
    const input = body as Record<string, unknown>;
    const data: Partial<Record<EditableField, string | null>> = {};
    for (const field of editableFields) {
      if (!(field in input)) continue;
      const value = input[field];
      if (value !== null && typeof value !== "string") return NextResponse.json({ success: false, message: `Field ${field} harus berupa teks.` }, { status: 400 });
      const normalized = typeof value === "string" ? value.trim() : null;
      if (normalized && normalized.length > (field === "footer" || field === "address" ? 2000 : 500)) return NextResponse.json({ success: false, message: `Nilai ${field} terlalu panjang.` }, { status: 400 });
      data[field] = normalized || null;
    }
    if (typeof data.name === "string" && !data.name) return NextResponse.json({ success: false, message: "Nama perusahaan wajib diisi." }, { status: 400 });
    if (typeof data.logo === "string" && data.logo && !data.logo.startsWith("/uploads/company/") && !/^https:\/\//i.test(data.logo)) return NextResponse.json({ success: false, message: "Logo harus berupa path upload perusahaan atau URL HTTPS." }, { status: 400 });
    const company = await prisma.company.findFirst({ orderBy: { id: "asc" } });
    const updated = company
      ? await prisma.company.update({ where: { id: company.id }, data })
      : await prisma.company.create({ data: { ...data, name: typeof data.name === "string" && data.name ? data.name : "PT. Mitra Garam Bogatama" } });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("COMPANY_PUT_ERROR", error);
    return NextResponse.json({ success: false, message: "Gagal menyimpan profil perusahaan." }, { status: 500 });
  }
}
