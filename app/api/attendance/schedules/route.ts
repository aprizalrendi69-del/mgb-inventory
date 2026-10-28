import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Parse a date-only value as UTC midnight so the calendar date stays stable
 * regardless of the server's timezone (for example, Asia/Jakarta).
 */
function parseDateOnly(value: unknown, endOfDay = false): Date {
  if (typeof value !== "string") {
    throw new Error("Format tanggal harus YYYY-MM-DD.");
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Format tanggal harus YYYY-MM-DD.");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  // Validate the components after construction to reject dates like 2026-02-31.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Tanggal tidak valid.");
  }

  if (endOfDay) date.setUTCHours(23, 59, 59, 999);
  return date;
}

const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const isOff = (value: unknown) => String(value ?? "").trim().toUpperCase() === "OFF";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const employeeParam = searchParams.get("employeeId");

    if (Boolean(start) !== Boolean(end)) {
      return NextResponse.json(
        { success: false, message: "Tanggal mulai dan akhir harus diisi bersama." },
        { status: 400 },
      );
    }

    const employeeId =
      employeeParam === null || employeeParam.trim() === ""
        ? undefined
        : Number(employeeParam);

    if (employeeId !== undefined && (!Number.isSafeInteger(employeeId) || employeeId < 1)) {
      return NextResponse.json(
        { success: false, message: "ID karyawan tidak valid." },
        { status: 400 },
      );
    }

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (start && end) {
      startDate = parseDateOnly(start);
      endDate = parseDateOnly(end, true);

      if (startDate > endDate) {
        return NextResponse.json(
          { success: false, message: "Tanggal akhir tidak boleh sebelum tanggal mulai." },
          { status: 400 },
        );
      }
    }

    const data = await prisma.employeeWorkSchedule.findMany({
      where: {
        ...(startDate && endDate ? { workDate: { gte: startDate, lte: endDate } } : {}),
        ...(employeeId !== undefined ? { employeeId } : {}),
      },
      include: {
        employee: {
          select: { id: true, nik: true, name: true, position: true, department: true },
        },
      },
      orderBy: [{ workDate: "asc" }, { employeeId: "asc" }],
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ATTENDANCE SCHEDULE GET", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Gagal memuat jadwal kerja.",
      },
      { status: 400 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rows: unknown[] = Array.isArray(body?.schedules) ? body.schedules : [body];

    if (
      !rows.length ||
      (rows.length === 1 && (rows[0] == null || typeof rows[0] !== "object"))
    ) {
      return NextResponse.json(
        { success: false, message: "Jadwal kosong atau format permintaan tidak valid." },
        { status: 400 },
      );
    }

    if (rows.length > 1000) {
      return NextResponse.json(
        { success: false, message: "Maksimal 1.000 jadwal per permintaan." },
        { status: 400 },
      );
    }

    const normalized = rows.map((input) => {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("Format salah satu jadwal tidak valid.");
      }

      const row = input as Record<string, unknown>;
      const employeeId = Number(row.employeeId);
      const workDate = parseDateOnly(String(row.workDate ?? row.date ?? ""));
      const off = isOff(row.shiftName);
      const shiftName = off ? "OFF" : String(row.shiftName ?? "Custom").trim();
      const startTime = off ? "00:00" : String(row.startTime ?? "").trim();
      const endTime =
        !off && row.endTime != null && String(row.endTime).trim() !== ""
          ? String(row.endTime).trim()
          : null;
      const workHours = off ? 0 : Number(row.workHours ?? 9);
      const note =
        row.note == null || String(row.note).trim() === ""
          ? null
          : String(row.note).trim().slice(0, 500);

      return { employeeId, workDate, shiftName, startTime, endTime, workHours, note, off };
    });

    const invalid = normalized.some(
      (row) =>
        !Number.isSafeInteger(row.employeeId) ||
        row.employeeId < 1 ||
        !row.shiftName ||
        !isTime(row.startTime) ||
        (!row.off &&
          (!Number.isFinite(row.workHours) || row.workHours <= 0 || row.workHours > 24)) ||
        (row.off && row.workHours !== 0) ||
        (row.endTime !== null && !isTime(row.endTime)),
    );

    if (invalid) {
      return NextResponse.json(
        {
          success: false,
          message: "Jadwal tidak valid. Periksa karyawan, tanggal, jam, dan durasi kerja.",
        },
        { status: 400 },
      );
    }

    // Use UTC date parts for duplicate detection, matching the UTC date-only storage above.
    const uniqueKeys = new Set(
      normalized.map(
        (row) =>
          `${row.employeeId}:${row.workDate.getUTCFullYear()}-${String(
            row.workDate.getUTCMonth() + 1,
          ).padStart(2, "0")}-${String(row.workDate.getUTCDate()).padStart(2, "0")}`,
      ),
    );

    if (uniqueKeys.size !== normalized.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Ada tanggal dan karyawan yang sama lebih dari sekali dalam satu permintaan.",
        },
        { status: 400 },
      );
    }

    const employeeIds = [...new Set(normalized.map((row) => row.employeeId))];
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds }, active: true },
      select: { id: true },
    });

    if (employees.length !== employeeIds.length) {
      return NextResponse.json(
        { success: false, message: "Ada karyawan yang tidak ditemukan atau nonaktif." },
        { status: 400 },
      );
    }

    const data = await prisma.$transaction(
      normalized.map((row) =>
        prisma.employeeWorkSchedule.upsert({
          where: {
            employeeId_workDate: {
              employeeId: row.employeeId,
              workDate: row.workDate,
            },
          },
          create: {
            employeeId: row.employeeId,
            workDate: row.workDate,
            shiftName: row.shiftName,
            startTime: row.startTime,
            endTime: row.endTime,
            workHours: row.workHours,
            note: row.note,
          },
          update: {
            shiftName: row.shiftName,
            startTime: row.startTime,
            endTime: row.endTime,
            workHours: row.workHours,
            note: row.note,
          },
        }),
      ),
    );

    return NextResponse.json({
      success: true,
      message: `${data.length} jadwal berhasil disimpan atau diperbarui.`,
      data,
    });
  } catch (error) {
    console.error("ATTENDANCE SCHEDULE POST", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Gagal menyimpan jadwal kerja.",
      },
      { status: 400 },
    );
  }
}
