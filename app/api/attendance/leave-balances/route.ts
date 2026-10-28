import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Use local calendar keys consistently with the date-only schedule/request values used by this app.
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function parseYear(value: string | null): number | null {
  if (value === null || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

const daysBetween = (start: Date, end: Date) => {
  const result: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= last) {
    result.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
};

const isOff = (shiftName?: string | null) => String(shiftName ?? "").trim().toUpperCase() === "OFF";

export async function GET(req: Request) {
  const year = parseYear(new URL(req.url).searchParams.get("year"));
  if (year === null) {
    return NextResponse.json({ success: false, message: "Tahun tidak valid. Gunakan format YYYY antara 2000–2100." }, { status: 400 });
  }

  try {
    const start = new Date(year, 0, 1);
    const nextYear = new Date(year + 1, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);

    const [employees, schedules, attendance, requests, balances] = await Promise.all([
      prisma.employee.findMany({ where: { active: true }, select: { id: true, nik: true, name: true, position: true, department: true }, orderBy: { name: "asc" } }),
      prisma.employeeWorkSchedule.findMany({ where: { workDate: { gte: start, lt: nextYear } }, select: { employeeId: true, workDate: true, shiftName: true, workHours: true } }),
      prisma.attendance.findMany({ where: { date: { gte: start, lt: nextYear }, checkIn: { not: null } }, select: { employeeId: true, date: true, checkIn: true } }),
      prisma.attendanceRequest.findMany({
        where: { status: "APPROVED", type: { in: ["CUTI", "PH"] }, startDate: { lte: end }, endDate: { gte: start } },
        select: { employeeId: true, type: true, startDate: true, endDate: true },
      }),
      prisma.employeeLeaveBalance.findMany({ where: { year }, select: { employeeId: true, entitlement: true, phAdjustment: true } }),
    ]);

    const scheduleMap = new Map<string, (typeof schedules)[number]>();
    for (const schedule of schedules) scheduleMap.set(`${schedule.employeeId}:${dateKey(schedule.workDate)}`, schedule);
    const workedMap = new Set(attendance.map((a) => `${a.employeeId}:${dateKey(a.date)}`));
    const usedLeave = new Map<number, Set<string>>();
    const usedPH = new Map<number, Set<string>>();

    for (const request of requests) {
      const first = new Date(Math.max(request.startDate.getTime(), start.getTime()));
      const last = new Date(Math.min(request.endDate.getTime(), end.getTime()));
      const target = request.type === "CUTI" ? usedLeave : usedPH;
      if (!target.has(request.employeeId)) target.set(request.employeeId, new Set<string>());
      for (const key of daysBetween(first, last)) {
        const schedule = scheduleMap.get(`${request.employeeId}:${key}`);
        if (schedule && !isOff(schedule.shiftName) && schedule.workHours > 0) target.get(request.employeeId)!.add(key);
      }
    }

    const phEarnedMap = new Map<number, number>();
    for (const schedule of schedules) {
      if (isOff(schedule.shiftName) && workedMap.has(`${schedule.employeeId}:${dateKey(schedule.workDate)}`)) {
        phEarnedMap.set(schedule.employeeId, (phEarnedMap.get(schedule.employeeId) ?? 0) + 1);
      }
    }

    const balanceMap = new Map(balances.map((balance) => [balance.employeeId, balance]));
    const data = employees.map((employee) => {
      const savedBalance = balanceMap.get(employee.id);
      const entitlement = savedBalance?.entitlement ?? 12;
      const phAdjustment = savedBalance?.phAdjustment ?? 0;
      const leaveUsed = usedLeave.get(employee.id)?.size ?? 0;
      const phEarned = phEarnedMap.get(employee.id) ?? 0;
      const phUsed = usedPH.get(employee.id)?.size ?? 0;
      return {
        employeeId: employee.id,
        employee,
        year,
        entitlement,
        leaveUsed,
        leaveBalance: entitlement - leaveUsed,
        phEarned,
        phUsed,
        phAdjustment,
        phBalance: phEarned - phUsed + phAdjustment,
      };
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ATTENDANCE LEAVE BALANCE GET", error);
    return NextResponse.json({ success: false, message: "Gagal menghitung saldo cuti dan PH." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const employeeId = Number(body?.employeeId);
    const year = Number(body?.year);
    const entitlement = Number(body?.entitlement);
    const phAdjustment = body?.phAdjustment == null || body.phAdjustment === "" ? 0 : Number(body.phAdjustment);
    if (!Number.isSafeInteger(employeeId) || employeeId < 1 || !Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isFinite(entitlement) || entitlement < 0 || entitlement > 366 || !Number.isFinite(phAdjustment) || phAdjustment < -366 || phAdjustment > 366) {
      return NextResponse.json({ success: false, message: "Karyawan, tahun, atau jatah cuti tidak valid." }, { status: 400 });
    }
    const employee = await prisma.employee.findFirst({ where: { id: employeeId, active: true }, select: { id: true } });
    if (!employee) return NextResponse.json({ success: false, message: "Karyawan tidak ditemukan atau nonaktif." }, { status: 404 });

    const data = await prisma.employeeLeaveBalance.upsert({
      where: { employeeId_year: { employeeId, year } },
      create: { employeeId, year, entitlement, phAdjustment },
      update: { entitlement, phAdjustment },
    });
    return NextResponse.json({ success: true, message: "Saldo cuti dan penyesuaian PH berhasil disimpan.", data });
  } catch (error) {
    console.error("ATTENDANCE LEAVE BALANCE POST", error);
    return NextResponse.json({ success: false, message: "Gagal menyimpan saldo cuti dan PH." }, { status: 500 });
  }
}
