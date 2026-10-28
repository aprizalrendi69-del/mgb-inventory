import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseDateOnly(value: string, endOfDay = false): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Format tanggal harus YYYY-MM-DD.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new Error("Tanggal tidak valid.");
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeParam = searchParams.get("employeeId");
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    if (Boolean(startParam) !== Boolean(endParam)) {
      return NextResponse.json({ success: false, message: "Tanggal mulai dan akhir harus diisi bersama." }, { status: 400 });
    }
    const employeeId = employeeParam === null || employeeParam.trim() === "" ? undefined : Number(employeeParam);
    if (employeeId !== undefined && (!Number.isSafeInteger(employeeId) || employeeId < 1)) {
      return NextResponse.json({ success: false, message: "ID karyawan tidak valid." }, { status: 400 });
    }

    let start: Date | undefined;
    let endExclusive: Date | undefined;
    if (startParam && endParam) {
      start = parseDateOnly(startParam);
      const end = parseDateOnly(endParam);
      if (start > end) return NextResponse.json({ success: false, message: "Tanggal akhir tidak boleh sebelum tanggal mulai." }, { status: 400 });
      endExclusive = new Date(end);
      endExclusive.setDate(endExclusive.getDate() + 1);
    }

    const data = await prisma.attendance.findMany({
      where: {
        ...(employeeId !== undefined ? { employeeId } : {}),
        ...(start && endExclusive ? { date: { gte: start, lt: endExclusive } } : {}),
      },
      include: { employee: { select: { id: true, nik: true, name: true, department: true, position: true } } },
      orderBy: [{ date: "desc" }, { employeeId: "asc" }],
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ATTENDANCE HISTORY GET", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Gagal memuat riwayat absensi." }, { status: 400 });
  }
}
