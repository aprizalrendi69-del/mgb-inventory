import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const MAX_SIZE = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };

export async function POST(request: NextRequest) {
  try {
    const store = await cookies();
    const sessionCookie = store.get("erp-session");
    if (!sessionCookie?.value) return NextResponse.json({ success: false, message: "Silakan login kembali." }, { status: 401 });
    let session: { id?: number };
    try { session = JSON.parse(sessionCookie.value); } catch { return NextResponse.json({ success: false, message: "Sesi tidak valid." }, { status: 401 }); }
    const user = session.id ? await prisma.user.findUnique({ where: { id: Number(session.id) }, select: { role: true, active: true } }) : null;
    if (!user?.active) return NextResponse.json({ success: false, message: "Akun tidak aktif atau sesi berakhir." }, { status: 401 });
    if (!["ADMIN", "MANAGER"].includes(user.role)) return NextResponse.json({ success: false, message: "Tidak memiliki akses mengunggah logo perusahaan." }, { status: 403 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ success: false, message: "Pilih file logo terlebih dahulu." }, { status: 400 });
    if (!TYPES[file.type]) return NextResponse.json({ success: false, message: "Format logo harus PNG, JPG, atau WEBP." }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_SIZE) return NextResponse.json({ success: false, message: "Ukuran logo harus lebih dari 0 dan maksimal 5 MB." }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    // Basic file signature validation prevents renamed non-image files being accepted.
    const valid = file.type === "image/png" ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : file.type === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : bytes.subarray(0,4).toString("ascii") === "RIFF" && bytes.subarray(8,12).toString("ascii") === "WEBP";
    if (!valid) return NextResponse.json({ success: false, message: "Isi file tidak cocok dengan format gambar." }, { status: 400 });
    const directory = path.join(process.cwd(), "public", "uploads", "company");
    await mkdir(directory, { recursive: true });
    const filename = `company-${crypto.randomUUID()}${TYPES[file.type]}`;
    await writeFile(path.join(directory, filename), bytes, { flag: "wx" });
    return NextResponse.json({ success: true, logo: `/uploads/company/${filename}` });
  } catch (error) {
    console.error("COMPANY_LOGO_UPLOAD_ERROR", error);
    return NextResponse.json({ success: false, message: "Gagal mengunggah logo perusahaan." }, { status: 500 });
  }
}
