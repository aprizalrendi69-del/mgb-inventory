import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Kode jenis pengajuan yang didukung API.
// I = Izin, S = Sakit.
const allowedTypes = new Set(["CUTI", "PH", "LEMBUR", "I", "S"]);

/**
 * Parse tanggal kalender YYYY-MM-DD sebagai tanggal UTC tanpa jam.
 * Jangan gunakan new Date(year, month - 1, day), karena hasilnya mengikuti
 * zona waktu server dan dapat menyebabkan tanggal bergeser saat disimpan.
 * Simpan tanggal mulai dan akhir pada UTC midnight secara konsisten.
 */
function parseDateOnly(value: string): Date {
  if (typeof value !== "string") throw new Error("Format tanggal harus YYYY-MM-DD.");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Format tanggal harus YYYY-MM-DD.");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Tanggal tidak valid.");
  }

  return date;
}

function normalizeType(value: unknown): string {
  const requestedType = String(value ?? "").trim().toUpperCase();
  // Alias untuk kompatibilitas dengan UI yang mengirim nama lengkap.
  if (requestedType === "IZIN") return "I";
  if (requestedType === "SAKIT") return "S";
  return requestedType;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedType = searchParams.get("type");
    const status = searchParams.get("status")?.trim().toUpperCase();
    const employeeParam = searchParams.get("employeeId");
    const employeeId =
      employeeParam === null || employeeParam.trim() === ""
        ? undefined
        : Number(employeeParam);

    if (
      employeeId !== undefined &&
      (!Number.isSafeInteger(employeeId) || employeeId < 1)
    ) {
      return NextResponse.json(
        { success: false, message: "ID karyawan tidak valid." },
        { status: 400 },
      );
    }

    const type = normalizeType(requestedType);
    if (type && type !== "SEMUA" && !allowedTypes.has(type)) {
      return NextResponse.json(
        { success: false, message: "Jenis pengajuan tidak valid." },
        { status: 400 },
      );
    }

    if (
      status &&
      status !== "SEMUA" &&
      !["PENDING", "APPROVED", "REJECTED"].includes(status)
    ) {
      return NextResponse.json(
        { success: false, message: "Status pengajuan tidak valid." },
        { status: 400 },
      );
    }

    const data = await prisma.attendanceRequest.findMany({
      where: {
        ...(type && type !== "SEMUA" ? { type } : {}),
        ...(status && status !== "SEMUA" ? { status } : {}),
        ...(employeeId !== undefined ? { employeeId } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            nik: true,
            name: true,
            position: true,
            department: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ATTENDANCE REQUEST GET", error);
    return NextResponse.json(
      { success: false, message: "Gagal memuat pengajuan." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const employeeId = Number(body?.employeeId);
    const type = normalizeType(body?.type);
    const reason = String(body?.reason ?? "").trim().slice(0, 2000);
    const startValue = String(body?.startDate ?? "").trim();
    const endValue = String(body?.endDate ?? body?.startDate ?? "").trim();
    const requestedHours =
      body?.requestedHours == null || body.requestedHours === ""
        ? null
        : Number(body.requestedHours);

    if (
      !Number.isSafeInteger(employeeId) ||
      employeeId < 1 ||
      !allowedTypes.has(type) ||
      !startValue ||
      !endValue ||
      !reason
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Karyawan, jenis, tanggal, dan alasan wajib diisi.",
        },
        { status: 400 },
      );
    }

    // Keduanya disimpan sebagai UTC midnight. Jangan simpan tanggal akhir
    // sebagai 23:59:59 karena dapat terbaca sebagai hari berikutnya di WIB.
    const startDate = parseDateOnly(startValue);
    const endDate = parseDateOnly(endValue);

    if (startDate.getTime() > endDate.getTime()) {
      return NextResponse.json(
        {
          success: false,
          message: "Tanggal akhir tidak boleh sebelum tanggal mulai.",
        },
        { status: 400 },
      );
    }

    if (
      type === "LEMBUR" &&
      (requestedHours === null ||
        !Number.isFinite(requestedHours) ||
        requestedHours <= 0 ||
        requestedHours > 24)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Durasi lembur wajib diisi (maksimal 24 jam).",
        },
        { status: 400 },
      );
    }

    if (
      type !== "LEMBUR" &&
      requestedHours !== null &&
      (!Number.isFinite(requestedHours) ||
        requestedHours < 0 ||
        requestedHours > 24)
    ) {
      return NextResponse.json(
        { success: false, message: "Durasi yang dimasukkan tidak valid." },
        { status: 400 },
      );
    }

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, active: true },
      select: { id: true },
    });

    if (!employee) {
      return NextResponse.json(
        { success: false, message: "Karyawan tidak ditemukan atau nonaktif." },
        { status: 404 },
      );
    }

    const data = await prisma.attendanceRequest.create({
      data: {
        employeeId,
        type,
        startDate,
        endDate,
        reason,
        requestedHours,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Pengajuan berhasil dikirim dan menunggu persetujuan.",
        data,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("ATTENDANCE REQUEST POST", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Gagal menyimpan pengajuan.",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = Number(body?.id);
    const status = String(body?.status ?? "").trim().toUpperCase();

    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      !["APPROVED", "REJECTED"].includes(status)
    ) {
      return NextResponse.json(
        { success: false, message: "Keputusan pengajuan tidak valid." },
        { status: 400 },
      );
    }

    // Perubahan status atomik mencegah dua reviewer memproses pengajuan yang sama.
    const updated = await prisma.attendanceRequest.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status,
        decisionNote: body?.decisionNote
          ? String(body.decisionNote).trim().slice(0, 2000)
          : null,
        reviewedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      const existing = await prisma.attendanceRequest.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, message: "Pengajuan tidak ditemukan." },
          { status: 404 },
        );
      }

      return NextResponse.json(
        { success: false, message: "Pengajuan ini sudah diproses." },
        { status: 409 },
      );
    }

    const data = await prisma.attendanceRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            nik: true,
            name: true,
            position: true,
            department: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: status === "APPROVED" ? "Pengajuan disetujui." : "Pengajuan ditolak.",
      data,
    });
  } catch (error) {
    console.error("ATTENDANCE REQUEST PATCH", error);
    return NextResponse.json(
      { success: false, message: "Gagal memproses pengajuan." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const id = Number(body?.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return NextResponse.json(
        { success: false, message: "ID pengajuan tidak valid." },
        { status: 400 },
      );
    }

    const existing = await prisma.attendanceRequest.findUnique({
      where: { id },
      select: { id: true, type: true, status: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Pengajuan tidak ditemukan." },
        { status: 404 },
      );
    }

    await prisma.attendanceRequest.delete({ where: { id } });

    // Kalender dan saldo dihitung dari pengajuan yang masih tersimpan.
    return NextResponse.json({
      success: true,
      message:
        "Pengajuan berhasil dihapus. Kalender dan saldo akan dihitung ulang dari data tersisa.",
    });
  } catch (error) {
    console.error("ATTENDANCE REQUEST DELETE", error);
    return NextResponse.json(
      { success: false, message: "Gagal menghapus pengajuan." },
      { status: 500 },
    );
  }
}
