"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock3, Download, FileText,
  Filter, Plus, RefreshCw, Search, Users, UserCheck, ClipboardCheck,
  Timer, X, CalendarCheck, CalendarOff, Save, Wallet, Check, AlertCircle,
  CircleCheck, CircleX, Sparkles, BriefcaseBusiness, CalendarClock,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Employee = { id: number; nik: string; name: string; position?: string | null; department?: string | null; active?: boolean; photo?: string | null };
type Attendance = { id: number; employeeId: number; date: string; checkIn?: string | null; checkOut?: string | null; shiftName?: string | null; scheduledIn?: string | null; expectedCheckout?: string | null; attendanceStatus?: string | null; employee?: Employee };
type Schedule = { id: number; employeeId: number; workDate: string; shiftName: string; startTime: string; endTime?: string | null; workHours: number; note?: string | null; employee?: Employee };
type RequestItem = { id: number; employeeId: number; type: string; startDate: string; endDate: string; reason: string; status: string; requestedHours?: number | null; employee?: Employee; createdAt: string };
type LeaveBalance = { employeeId: number; year: number; entitlement: number; leaveUsed: number; leaveBalance: number; phEarned: number; phUsed: number; phAdjustment?: number; phBalance: number };
type ScheduleForm = { employeeId: string; startDate: string; endDate: string; mode: "MONTHLY" | "RANGE" | "SINGLE"; shiftName: string; startTime: string; endTime: string; workHours: string; offDays: number[]; halfDays: number[]; halfDayStart: string; halfDayEnd: string; halfDayHours: string };

const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const weekDays = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const keyDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// Normalisasi tanggal kalender tanpa membuang zona waktu dari timestamp API.
 // Prisma/JSON dapat mengirim Date sebagai ISO UTC; memotong 10 karakter pertama
 // bisa membuat tanggal bergeser sehari di zona waktu Asia/Jakarta.
const dateOnly = (v: string | Date) => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : keyDate(v);
  const value = String(v ?? "").trim();
  if (!value) return "";
  // Nilai date-only dari input/API harus dipertahankan persis apa adanya.
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return value;
  // Timestamp API dibaca memakai zona waktu bisnis Indonesia (WIB), bukan
  // dengan memotong tanggal UTC yang dapat mundur satu hari.
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const dateText = (v: string) => { if (!v) return "—"; const d = new Date(`${dateOnly(v)}T12:00:00`); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }); };
const timeText = (v?: string | null) => { if (!v) return "—"; if (/^\d{2}:\d{2}$/.test(v)) return v; const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); };
const shiftDefaults: Record<string, string> = { Morning: "08:00", Middle: "11:30", Evening: "13:00", Admin: "09:00", "Half Day": "09:00", Custom: "09:00" };
const defaultScheduleForm = (): ScheduleForm => { const now = new Date(); return { employeeId: "", startDate: keyDate(now), endDate: keyDate(now), mode: "MONTHLY", shiftName: "Admin", startTime: "09:00", endTime: "18:00", workHours: "9", offDays: [0], halfDays: [6], halfDayStart: "09:00", halfDayEnd: "13:00", halfDayHours: "4" }; };
const statusText = (status?: string | null) => ({ LATE: "Terlambat", PRESENT: "Hadir", HADIR: "Hadir", ABSENT: "Tidak hadir", LEAVE: "Cuti", OFF: "Libur", SELESAI: "Selesai" } as Record<string, string>)[String(status || "").toUpperCase()] || status || "—";
const isOff = (s?: Schedule) => s?.shiftName?.trim().toUpperCase() === "OFF";
const isHalfDay = (s?: Schedule) => Boolean(s?.shiftName?.toLowerCase().includes("half"));
const errorMessage = (e: unknown) => e instanceof Error ? e.message : "Terjadi kesalahan.";
const num = (v: number) => Number.isInteger(v) ? String(v) : v.toLocaleString("id-ID", { maximumFractionDigits: 2 });

export default function AttendanceDashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("SEMUA");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(defaultScheduleForm);
  const [requestForm, setRequestForm] = useState({ employeeId: "", type: "CUTI", startDate: keyDate(new Date()), endDate: keyDate(new Date()), reason: "", requestedHours: "" });
  const [saving, setSaving] = useState(false);
  const [decidingId, setDecidingId] = useState<number | null>(null);
  const [editingBalanceId, setEditingBalanceId] = useState<number | null>(null);
  const [balanceDraft, setBalanceDraft] = useState({ entitlement: "12", phAdjustment: "0" });
  const [deletingRequestId, setDeletingRequestId] = useState<number | null>(null);

  const year = month.getFullYear();
  const monthStart = keyDate(new Date(year, month.getMonth(), 1));
  const monthEnd = keyDate(new Date(year, month.getMonth() + 1, 0));

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const urls = ["/api/employee", `/api/attendance/history?start=${monthStart}&end=${monthEnd}`, `/api/attendance/schedules?start=${monthStart}&end=${monthEnd}`, "/api/attendance/requests", `/api/attendance/leave-balances?year=${year}`];
      const responses = await Promise.all(urls.map((url) => fetch(url, { cache: "no-store" })));
      const payloads = await Promise.all(responses.map(async (r) => { const json = await r.json().catch(() => ({})); if (!r.ok || !json.success) throw new Error(json.message || `Gagal memuat ${r.url}`); return json; }));
      setEmployees(Array.isArray(payloads[0].data) ? payloads[0].data : []);
      setAttendance(Array.isArray(payloads[1].data) ? payloads[1].data : []);
      setSchedules(Array.isArray(payloads[2].data) ? payloads[2].data : []);
      setRequests(Array.isArray(payloads[3].data) ? payloads[3].data : []);
      setBalances(Array.isArray(payloads[4].data) ? payloads[4].data : []);
    } catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }, [monthStart, monthEnd, year]);
  useEffect(() => { void load(); }, [load]);

  const activeEmployees = useMemo(() => employees.filter((e) => e.active !== false), [employees]);
  const departments = useMemo(() => Array.from(new Set(activeEmployees.map((e) => e.department?.trim()).filter((v): v is string => Boolean(v))).values()).sort(), [activeEmployees]);
  const filteredEmployees = useMemo(() => { const q = search.trim().toLowerCase(); return activeEmployees.filter((e) => { const text = `${e.name} ${e.nik} ${e.position || ""} ${e.department || ""}`.toLowerCase(); return (!q || text.includes(q)) && (department === "SEMUA" || e.department === department); }); }, [activeEmployees, search, department]);
  const scheduleMap = useMemo(() => new Map(schedules.map((s) => [`${s.employeeId}:${dateOnly(s.workDate)}`, s])), [schedules]);
  const attendanceMap = useMemo(() => new Map(attendance.map((a) => [`${a.employeeId}:${dateOnly(a.date)}`, a])), [attendance]);
  // Pengajuan CUTI/PH yang sudah disetujui dipetakan ke setiap tanggal yang tercakup.
  // Pemetaan ini hanya untuk tampilan kalender; tidak mengubah/menghapus record absensi.
  const approvedRequestMap = useMemo(() => {
    const map = new Map<string, RequestItem>();
    const approved = requests
      .filter((r) => String(r.status).toUpperCase() === "APPROVED" && ["CUTI", "PH", "I", "S", "IZIN", "SAKIT"].includes(String(r.type).toUpperCase()))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    for (const r of approved) {
      const from = new Date(`${dateOnly(r.startDate)}T12:00:00`);
      const to = new Date(`${dateOnly(r.endDate)}T12:00:00`);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) continue;
      for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const key = `${r.employeeId}:${keyDate(d)}`;
        // Pengajuan terakhir yang disetujui menjadi representasi tanggal tersebut.
        map.set(key, r);
      }
    }
    return map;
  }, [requests]);
  const balanceMap = useMemo(() => new Map(balances.map((b) => [b.employeeId, b])), [balances]);
  const todayKey = keyDate(new Date());
  const presentToday = new Set(attendance.filter((a) => dateOnly(a.date) === todayKey && a.checkIn).map((a) => a.employeeId)).size;
  const pending = requests.filter((r) => r.status === "PENDING");
  const days = new Date(year, month.getMonth() + 1, 0).getDate();
  const offset = new Date(year, month.getMonth(), 1).getDay();
  const fmtMonth = `${monthNames[month.getMonth()]} ${year}`;
  const scheduleDays = new Set(schedules.map((s) => dateOnly(s.workDate))).size;

  function openNewSchedule(date?: string) { const from = date || monthStart; const to = date || monthEnd; setEditingSchedule(null); setScheduleForm({ ...defaultScheduleForm(), startDate: from, endDate: to, mode: date ? "SINGLE" : "MONTHLY" }); setError(""); setNotice(""); setScheduleOpen(true); }
  function openEditSchedule(s: Schedule) { const off = isOff(s); const day = new Date(`${dateOnly(s.workDate)}T12:00:00`).getDay(); setEditingSchedule(s); setScheduleForm({ ...defaultScheduleForm(), employeeId: String(s.employeeId), startDate: dateOnly(s.workDate), endDate: dateOnly(s.workDate), mode: "SINGLE", shiftName: s.shiftName, startTime: s.startTime || "09:00", endTime: s.endTime || "", workHours: String(s.workHours ?? 9), offDays: off ? [day] : [], halfDays: [], halfDayStart: s.startTime || "09:00", halfDayEnd: s.endTime || "13:00", halfDayHours: String(s.workHours || 4) }); setError(""); setNotice(""); setScheduleOpen(true); }
  function toggleDay(field: "offDays" | "halfDays", day: number, checked: boolean) { setScheduleForm((v) => { const next = checked ? [...new Set([...v[field], day])] : v[field].filter((d) => d !== day); return { ...v, [field]: next, ...(field === "offDays" && checked ? { halfDays: v.halfDays.filter((d) => d !== day) } : {}), ...(field === "halfDays" && checked ? { offDays: v.offDays.filter((d) => d !== day) } : {}) }; }); }
  function changeShift(shiftName: string) { setScheduleForm((v) => ({ ...v, shiftName, startTime: shiftName === "OFF" ? "00:00" : shiftDefaults[shiftName] || v.startTime, endTime: shiftName === "OFF" ? "" : shiftName === "Admin" ? "18:00" : shiftName === "Half Day" ? "13:00" : v.endTime || "17:00", workHours: shiftName === "OFF" ? "0" : shiftName === "Half Day" ? "4" : v.workHours === "0" ? "9" : v.workHours })); }

  async function saveSchedule(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      if (!scheduleForm.employeeId) throw new Error("Pilih karyawan terlebih dahulu.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleForm.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(scheduleForm.endDate)) throw new Error("Tanggal jadwal tidak valid.");
      const from = new Date(`${scheduleForm.startDate}T12:00:00`); const to = new Date(`${scheduleForm.endDate}T12:00:00`);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) throw new Error("Rentang tanggal jadwal tidak valid.");
      if (scheduleForm.mode !== "SINGLE" && (from.getMonth() !== to.getMonth() || from.getFullYear() !== to.getFullYear())) throw new Error("Rentang jadwal tidak boleh melewati bulan.");
      const dates: Date[] = []; for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) dates.push(new Date(d));
      const rows = dates.map((date) => { const day = date.getDay(); const off = scheduleForm.mode !== "SINGLE" && scheduleForm.offDays.includes(day); const half = !off && scheduleForm.mode !== "SINGLE" && scheduleForm.halfDays.includes(day); const singleOff = scheduleForm.mode === "SINGLE" && scheduleForm.shiftName.toUpperCase() === "OFF"; const employeeId = Number(scheduleForm.employeeId); if (off || singleOff) return { employeeId, workDate: keyDate(date), shiftName: "OFF", startTime: "00:00", endTime: null, workHours: 0, note: off ? "LIBUR MINGGUAN" : "LIBUR" }; if (half) return { employeeId, workDate: keyDate(date), shiftName: "Half Day", startTime: scheduleForm.halfDayStart, endTime: scheduleForm.halfDayEnd || null, workHours: Number(scheduleForm.halfDayHours), note: "JADWAL SETENGAH HARI" }; const isSingleHalf = scheduleForm.mode === "SINGLE" && scheduleForm.shiftName === "Half Day"; return { employeeId, workDate: keyDate(date), shiftName: scheduleForm.shiftName, startTime: scheduleForm.shiftName === "OFF" ? "00:00" : scheduleForm.startTime, endTime: scheduleForm.shiftName === "OFF" ? null : (isSingleHalf ? scheduleForm.endTime || scheduleForm.halfDayEnd || null : scheduleForm.endTime || null), workHours: scheduleForm.shiftName === "OFF" ? 0 : Number(isSingleHalf ? scheduleForm.workHours || scheduleForm.halfDayHours : scheduleForm.workHours), note: null }; });
      if (rows.some((r) => !/^\d{4}-\d{2}-\d{2}$/.test(r.workDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.startTime) || (r.endTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.endTime)) || !Number.isFinite(r.workHours) || r.workHours < 0 || r.workHours > 24 || (r.shiftName !== "OFF" && r.workHours <= 0))) throw new Error("Jam atau durasi jadwal tidak valid.");
      const res = await fetch("/api/attendance/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schedules: rows }) }); const json = await res.json(); if (!res.ok || !json.success) throw new Error(json.message || "Gagal menyimpan jadwal.");
      setScheduleOpen(false); setEditingSchedule(null); setNotice(json.message || "Jadwal berhasil disimpan."); await load();
    } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); }
  }
  async function submitRequest(e: FormEvent) { e.preventDefault(); setSaving(true); setError(""); setNotice(""); try { if (!requestForm.employeeId) throw new Error("Pilih karyawan terlebih dahulu."); if (!requestForm.startDate || !requestForm.endDate || new Date(`${requestForm.endDate}T12:00:00`) < new Date(`${requestForm.startDate}T12:00:00`)) throw new Error("Tanggal pengajuan tidak valid."); const hours = Number(requestForm.requestedHours); if (requestForm.type === "LEMBUR" && (!Number.isFinite(hours) || hours <= 0 || hours > 24)) throw new Error("Masukkan durasi lembur antara 0,5 dan 24 jam."); const res = await fetch("/api/attendance/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...requestForm, employeeId: Number(requestForm.employeeId), requestedHours: requestForm.type === "LEMBUR" ? hours : null }) }); const json = await res.json(); if (!res.ok || !json.success) throw new Error(json.message || "Gagal mengirim pengajuan."); setNotice(json.message || "Pengajuan berhasil dikirim."); setRequestOpen(false); setRequestForm((v) => ({ ...v, reason: "", requestedHours: "" })); await load(); } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); } }
  async function decideRequest(id: number, status: "APPROVED" | "REJECTED") { setDecidingId(id); setError(""); setNotice(""); try { const res = await fetch("/api/attendance/requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }); const json = await res.json(); if (!res.ok || !json.success) throw new Error(json.message || "Keputusan gagal disimpan."); setNotice(json.message || "Keputusan berhasil disimpan."); await load(); } catch (e) { setError(errorMessage(e)); } finally { setDecidingId(null); } }
  async function deleteRequest(id: number) { if (!window.confirm("Hapus pengajuan ini? Jika pengajuan cuti/PH disetujui, tampilan kalender akan kembali mengikuti jadwal dan absensi asli.")) return; setDeletingRequestId(id); setError(""); setNotice(""); try { const res = await fetch("/api/attendance/requests", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); const json = await res.json(); if (!res.ok || !json.success) throw new Error(json.message || "Pengajuan gagal dihapus."); setNotice(json.message || "Pengajuan dihapus."); await load(); } catch (e) { setError(errorMessage(e)); } finally { setDeletingRequestId(null); } }
  async function saveBalance(employeeId: number) { const requestedLeaveBalance = Number(balanceDraft.entitlement); const entitlement = requestedLeaveBalance + (balanceMap.get(employeeId)?.leaveUsed ?? 0); const phAdjustment = Number(balanceDraft.phAdjustment); if (!Number.isFinite(requestedLeaveBalance) || requestedLeaveBalance < 0 || requestedLeaveBalance > 366 || !Number.isFinite(phAdjustment) || phAdjustment < -366 || phAdjustment > 366) { setError("Saldo cuti/penyesuaian PH tidak valid."); return; } setSaving(true); setError(""); setNotice(""); try { const res = await fetch("/api/attendance/leave-balances", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId, year, entitlement, phAdjustment }) }); const json = await res.json(); if (!res.ok || !json.success) throw new Error(json.message || "Saldo gagal disimpan."); setEditingBalanceId(null); setNotice("Saldo cuti dan penyesuaian PH berhasil disimpan."); await load(); } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); } }

  function exportCsv() { const rows: string[][] = [["NIK", "Nama", "Jabatan", "Departemen", "Tanggal", "Shift", "Jadwal Masuk", "Absen Masuk", "Estimasi Pulang", "Absen Pulang", "Status"]]; attendance.forEach((a) => rows.push([a.employee?.nik || "", a.employee?.name || "", a.employee?.position || "", a.employee?.department || "", dateOnly(a.date), a.shiftName || "", timeText(a.scheduledIn), timeText(a.checkIn), timeText(a.expectedCheckout), timeText(a.checkOut), statusText(a.attendanceStatus || (a.checkOut ? "SELESAI" : a.checkIn ? "HADIR" : ""))])); const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n"); const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })); const a = document.createElement("a"); a.href = url; a.download = `absensi-${year}-${String(month.getMonth() + 1).padStart(2, "0")}.csv`; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
  async function exportPdf() {
    setExporting(true);
    setError("");
    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const stamp = new Date().toLocaleString("id-ID");
      const selected = filteredEmployees;
      const selectedIds = new Set(selected.map((emp) => emp.id));
      const weekdayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

      const drawHeader = (title: string, subtitle: string) => {
        pdf.setFillColor(15, 35, 55);
        pdf.rect(0, 0, pageWidth, 27, "F");
        pdf.setFillColor(26, 119, 96);
        pdf.rect(0, 27, pageWidth, 1.5, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.text(title, 10, 11);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.text(subtitle, 10, 19);
      };
      const drawFooter = () => {
        pdf.setDrawColor(215, 224, 230);
        pdf.line(10, pageHeight - 10, pageWidth - 10, pageHeight - 10);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`MGB ERP · ${fmtMonth} · Dicetak ${stamp}`, 10, pageHeight - 5);
        pdf.text(`Halaman ${pdf.getNumberOfPages()}`, pageWidth - 10, pageHeight - 5, { align: "right" });
      };
      const pageSubtitle = `Departemen: ${department} · ${selected.length} staff · ${fmtMonth}`;

      if (!selected.length) {
        drawHeader("KALENDER JADWAL STAFF", pageSubtitle);
        pdf.setTextColor(80, 90, 100);
        pdf.setFontSize(10);
        pdf.text("Tidak ada staff yang cocok dengan filter.", 12, 42);
        drawFooter();
      } else {
        // 1. Kalender bulanan: staff sebagai baris dan tanggal sebagai kolom.
        drawHeader("KALENDER JADWAL STAFF", `${pageSubtitle} · M/Md/E = shift · C = Cuti · PH = Pengganti Hari Libur`);
        const calendarHead = [[
          "NAMA STAFF",
          ...Array.from({ length: days }, (_, i) => `${i + 1}\n${weekdayNames[new Date(year, month.getMonth(), i + 1).getDay()]}`),
        ]];
        const calendarBody = selected.map((emp) => [
          `${emp.name}\n${emp.nik}${emp.department ? ` · ${emp.department}` : ""}`,
          ...Array.from({ length: days }, (_, i) => {
            const date = keyDate(new Date(year, month.getMonth(), i + 1));
            const schedule = scheduleMap.get(`${emp.id}:${date}`);
            const attendanceItem = attendanceMap.get(`${emp.id}:${date}`);
            const request = approvedRequestMap.get(`${emp.id}:${date}`);
            let code = "·";
            if (isOff(schedule)) code = "OFF";
            else if (isHalfDay(schedule)) code = "½";
            else if (schedule) {
              const shiftName = schedule.shiftName.trim().toLowerCase();
              code = shiftName === "morning" ? "M"
                : shiftName === "middle" ? "Md"
                : shiftName === "evening" ? "E"
                : shiftName === "admin" ? "A"
                : shiftName.includes("half") ? "½"
                : shiftName === "custom" ? "J"
                : schedule.shiftName.slice(0, 3).toUpperCase();
            }
            if (attendanceItem?.checkIn) code = attendanceItem.attendanceStatus === "LATE" ? "T" : "H";
            if (request) {
              const type = String(request.type).toUpperCase();
              code = type === "CUTI" ? "C"
                : type === "PH" ? "PH"
                : type === "I" || type === "IZIN" ? "I"
                : type === "S" || type === "SAKIT" ? "S"
                : code;
            }
            return code;
          }),
        ]);

        autoTable(pdf, {
          startY: 33,
          head: calendarHead,
          body: calendarBody,
          theme: "grid",
          margin: { left: 7, right: 7, top: 33, bottom: 13 },
          styles: {
            font: "helvetica",
            fontSize: 5.5,
            cellPadding: 1.1,
            halign: "center",
            valign: "middle",
            lineColor: [215, 224, 230],
            lineWidth: 0.15,
            overflow: "linebreak",
            minCellHeight: 7,
          },
          headStyles: { fillColor: [226, 238, 234], textColor: [35, 55, 65], fontStyle: "bold", fontSize: 5.5 },
          columnStyles: {
            0: { cellWidth: 43, halign: "left", fontStyle: "bold", fontSize: 6 },
          },
          didDrawPage: () => {
            drawHeader("KALENDER JADWAL STAFF", `${pageSubtitle} · M/Md/E = shift · C = Cuti · PH = Pengganti Hari Libur`);
            drawFooter();
          },
        });

        // 2. Saldo cuti dan PH diletakkan setelah kalender.
        pdf.addPage("a4", "landscape");
        drawHeader("RINGKASAN SALDO CUTI & PH", `Tahun ${year} · ${pageSubtitle}`);
        autoTable(pdf, {
          startY: 33,
          head: [["NIK", "Nama Staff", "Departemen", "Hak Cuti", "Cuti Terpakai", "Sisa Cuti", "PH Diperoleh", "PH Terpakai", "Penyesuaian PH", "Sisa PH"]],
          body: selected.map((emp) => {
            const balance = balanceMap.get(emp.id);
            const entitlement = balance?.entitlement ?? 12;
            const earned = balance?.phEarned ?? 0;
            const used = balance?.phUsed ?? 0;
            const adjustment = balance?.phAdjustment ?? 0;
            return [
              emp.nik,
              emp.name,
              emp.department || "—",
              num(entitlement),
              num(balance?.leaveUsed ?? 0),
              num(balance?.leaveBalance ?? entitlement),
              num(earned),
              num(used),
              num(adjustment),
              num(balance?.phBalance ?? earned - used + adjustment),
            ];
          }),
          theme: "grid",
          styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2.5, overflow: "linebreak" },
          headStyles: { fillColor: [15, 35, 55], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [243, 247, 249] },
          margin: { left: 10, right: 10, top: 33, bottom: 13 },
          didDrawPage: () => {
            drawHeader("RINGKASAN SALDO CUTI & PH", `Tahun ${year} · ${pageSubtitle}`);
            drawFooter();
          },
        });

        // 3. Detail absensi diletakkan setelah ringkasan saldo.
        pdf.addPage("a4", "landscape");
        drawHeader("DETAIL ABSENSI STAFF", pageSubtitle);
        const detailRows = attendance
          .filter((item) => selectedIds.has(item.employeeId))
          .sort((a, b) => dateOnly(a.date).localeCompare(dateOnly(b.date)) || (a.employee?.name || "").localeCompare(b.employee?.name || ""))
          .map((item) => {
            const date = dateOnly(item.date);
            const schedule = scheduleMap.get(`${item.employeeId}:${date}`);
            return [
              dateText(date),
              item.employee?.nik || "—",
              item.employee?.name || `Staff #${item.employeeId}`,
              item.employee?.department || "—",
              schedule?.shiftName || item.shiftName || "—",
              schedule ? `${schedule.startTime || "—"}–${schedule.endTime || "—"}` : `${timeText(item.scheduledIn)}–${timeText(item.expectedCheckout)}`,
              timeText(item.checkIn),
              timeText(item.checkOut),
              statusText(item.attendanceStatus || (item.checkOut ? "SELESAI" : item.checkIn ? "HADIR" : "—")),
            ];
          });
        autoTable(pdf, {
          startY: 33,
          head: [["Tanggal", "NIK", "Nama Staff", "Departemen", "Shift", "Jadwal", "Absen Masuk", "Absen Pulang", "Status"]],
          body: detailRows,
          theme: "grid",
          styles: { font: "helvetica", fontSize: 7, cellPadding: 2, overflow: "linebreak" },
          headStyles: { fillColor: [15, 35, 55], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [243, 247, 249] },
          margin: { left: 10, right: 10, top: 33, bottom: 13 },
          showHead: "everyPage",
          didDrawPage: () => {
            drawHeader("DETAIL ABSENSI STAFF", pageSubtitle);
            drawFooter();
          },
        });
      }

      // Nomor halaman final untuk seluruh halaman PDF.
      for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
        pdf.setPage(page);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Halaman ${page} dari ${pdf.getNumberOfPages()}`, pageWidth - 10, pageHeight - 5, { align: "right" });
      }
      pdf.save(`kalender-jadwal-absensi-${year}-${String(month.getMonth() + 1).padStart(2, "0")}-${department.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`);
    } catch (e) {
      setError(`PDF gagal dibuat: ${errorMessage(e)}`);
    } finally {
      setExporting(false);
    }
  }
  function openRequestForm() { setRequestForm((v) => ({ ...v, employeeId: v.employeeId || (activeEmployees[0] ? String(activeEmployees[0].id) : "") })); setRequestOpen(true); }

  const inputClass = "mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const cardClass = "rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_-20px_rgba(15,23,42,.35)] dark:border-slate-800 dark:bg-[#111c2d]";

  return <main className="min-h-full bg-[#f3f6fa] p-4 text-slate-800 dark:bg-[#0b1220] dark:text-slate-100 sm:p-6"><div className="mx-auto max-w-[1800px] space-y-5">
    <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#10263b] via-[#163c4b] to-[#145c50] p-5 text-white shadow-xl shadow-slate-900/10 sm:p-7"><div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-white/10"/><div className="pointer-events-none absolute -right-2 -top-8 h-44 w-44 rounded-full border border-white/10"/><div className="relative flex flex-col justify-between gap-5 xl:flex-row xl:items-center"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-emerald-100"><Sparkles size={13}/> Human Resources · MGB ERP</div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Kalender Absensi Staff</h1><p className="mt-2 max-w-2xl text-sm text-slate-200">Kelola jadwal kerja, kehadiran, pengajuan, dan saldo cuti serta PH dalam satu dashboard.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => openNewSchedule()} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#15394a] shadow-sm transition hover:bg-emerald-50"><Plus size={16}/> Buat Jadwal</button><button onClick={openRequestForm} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/15"><ClipboardCheck size={16}/> Pengajuan</button><button onClick={exportPdf} disabled={loading || exporting} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200/30 bg-emerald-300/15 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-300/25 disabled:opacity-50"><FileText size={16}/>{exporting ? "Membuat PDF…" : "Export PDF"}</button><button onClick={exportCsv} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm font-semibold transition hover:bg-white/15 disabled:opacity-50"><Download size={16}/> CSV</button><button onClick={() => void load()} disabled={loading} aria-label="Muat ulang" className="rounded-xl border border-white/20 bg-white/10 p-2.5 transition hover:bg-white/15 disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/></button></div></div></header>
    {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><span className="flex gap-2"><AlertCircle size={17} className="mt-0.5 shrink-0"/>{error}</span><button onClick={() => setError("")} aria-label="Tutup pesan"><X size={16}/></button></div>}
    {notice && <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><span className="flex gap-2"><CircleCheck size={17} className="mt-0.5 shrink-0"/>{notice}</span><button onClick={() => setNotice("")} aria-label="Tutup pesan"><X size={16}/></button></div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Staff Aktif", value: activeEmployees.length, sub: "Karyawan terdaftar", icon: Users, tone: "emerald" }, { label: "Hadir Hari Ini", value: presentToday, sub: `dari ${activeEmployees.length} staff`, icon: UserCheck, tone: "sky" }, { label: "Pengajuan Pending", value: pending.length, sub: "Menunggu persetujuan", icon: ClipboardCheck, tone: "amber" }, { label: "Hari Terjadwal", value: scheduleDays, sub: "Hari kalender dengan jadwal", icon: CalendarCheck, tone: "violet" }].map((c) => <div key={c.label} className={`${cardClass} group p-4 transition hover:-translate-y-0.5 hover:shadow-lg`}><div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500 dark:text-slate-400">{c.label}</span><span className="rounded-xl bg-slate-100 p-2.5 text-slate-700 transition group-hover:bg-emerald-50 group-hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-200 dark:group-hover:bg-emerald-950/60 dark:group-hover:text-emerald-300"><c.icon size={18}/></span></div><div className="mt-3 text-3xl font-black tracking-tight">{loading ? "—" : c.value}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.sub}</div></div>)}</section>
    <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_350px]"><div className="min-w-0 space-y-4"><div className={`${cardClass} flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center`}><div><div className="flex items-center gap-2"><CalendarClock size={17} className="text-emerald-600"/><h2 className="font-bold">Jadwal & Kehadiran</h2></div><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Pilih tanggal pada kalender untuk membuat atau mengedit jadwal.</p></div><div className="flex items-center gap-2"><button aria-label="Bulan sebelumnya" onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="rounded-lg border border-slate-200 p-2 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><ChevronLeft size={17}/></button><strong className="min-w-36 text-center text-sm">{fmtMonth}</strong><button aria-label="Bulan berikutnya" onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="rounded-lg border border-slate-200 p-2 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><ChevronRight size={17}/></button><button onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Hari ini</button></div></div>
    <div className={`${cardClass} overflow-hidden`}><div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, NIK, jabatan…" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900"/></div><div className="relative"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15}/><select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-7 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="SEMUA">Semua Departemen</option>{departments.map((d) => <option key={d} value={d}>{d}</option>)}</select></div></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[1050px] border-collapse text-left text-xs"><thead><tr className="bg-slate-50 text-slate-500 dark:bg-slate-900/80 dark:text-slate-400"><th className="sticky left-0 z-10 min-w-40 border-r border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900">Staff</th>{Array.from({ length: days }, (_, i) => <th key={i} className="px-1 py-3 text-center">{i + 1}<div className="mt-1 font-normal">{weekDays[new Date(year, month.getMonth(), i + 1).getDay()]}</div></th>)}<th className="px-3 py-3 text-center">Hadir</th><th className="px-3 py-3 text-center">Sisa Cuti</th><th className="px-3 py-3 text-center">Sisa PH</th></tr></thead><tbody>{filteredEmployees.map((emp) => { const present = Array.from({ length: days }, (_, i) => attendanceMap.get(`${emp.id}:${keyDate(new Date(year, month.getMonth(), i + 1))}`)).filter((a) => a?.checkIn).length; const b = balanceMap.get(emp.id); const leaveBalance = b?.leaveBalance ?? (b?.entitlement ?? 12); const phBalance = b?.phBalance ?? ((b?.phEarned ?? 0) - (b?.phUsed ?? 0)); return <tr key={emp.id} className="border-t border-slate-100 transition hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-900/40"><td className="sticky left-0 z-[1] min-w-40 border-r border-slate-100 bg-white px-3 py-3 dark:border-slate-800 dark:bg-[#111c2d]"><div className="font-bold">{emp.name}</div><div className="mt-1 text-[10px] text-slate-500">{emp.position || emp.department || emp.nik}</div></td>{Array.from({ length: days }, (_, i) => { const date = keyDate(new Date(year, month.getMonth(), i + 1)); const s = scheduleMap.get(`${emp.id}:${date}`); const a = attendanceMap.get(`${emp.id}:${date}`); const approvedRequest = approvedRequestMap.get(`${emp.id}:${date}`); let label = "·"; let style = "text-slate-400 bg-slate-50 dark:bg-slate-800 dark:text-slate-500"; let title = "Belum dijadwalkan"; if (isOff(s)) { label = "OFF"; style = "text-slate-600 bg-slate-200 dark:bg-slate-700 dark:text-slate-200"; title = `Libur · ${s?.note || "Hari libur"}`; } else if (isHalfDay(s)) { label = "½"; style = "text-amber-800 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200"; title = `Setengah hari · ${s?.startTime}–${s?.endTime || "—"}`; } else if (s) { label = s.shiftName === "Morning" ? "M" : s.shiftName === "Middle" ? "Md" : s.shiftName === "Evening" ? "E" : s.shiftName === "Admin" ? "A" : "J"; style = "text-sky-700 bg-sky-50 dark:bg-sky-950/50 dark:text-sky-300"; title = `${s.shiftName} · ${s.startTime}–${s.endTime || "—"}`; } if (a?.checkIn) { label = a.attendanceStatus === "LATE" ? "T" : "H"; style = a.attendanceStatus === "LATE" ? "text-rose-700 bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300" : "text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"; title = `${statusText(a.attendanceStatus)} · ${timeText(a.checkIn)}`; } if (approvedRequest) { const requestType = String(approvedRequest.type).toUpperCase(); if (requestType === "CUTI") { label = "C"; style = "text-violet-800 bg-violet-100 ring-1 ring-violet-200 dark:bg-violet-950/60 dark:text-violet-200 dark:ring-violet-900"; title = `Cuti disetujui · ${approvedRequest.reason}`; } else if (requestType === "PH") { label = "PH"; style = "text-fuchsia-800 bg-fuchsia-100 ring-1 ring-fuchsia-200 dark:bg-fuchsia-950/60 dark:text-fuchsia-200 dark:ring-fuchsia-900"; title = `PH disetujui · ${approvedRequest.reason}`; } else if (requestType === "I" || requestType === "IZIN") { label = "I"; style = "text-sky-800 bg-sky-100 ring-1 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:ring-sky-900"; title = `Izin disetujui · ${approvedRequest.reason}`; } else if (requestType === "S" || requestType === "SAKIT") { label = "S"; style = "text-rose-800 bg-rose-100 ring-1 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:ring-rose-900"; title = `Sakit disetujui · ${approvedRequest.reason}`; } } return <td key={i} className="px-0.5 py-2 text-center"><button type="button" title={`${dateText(date)} · ${title}. Klik untuk mengedit.`} onClick={() => { if (s) openEditSchedule(s); else { openNewSchedule(date); setScheduleForm((v) => ({ ...v, employeeId: String(emp.id), startDate: date, endDate: date, mode: "SINGLE" })); } }} className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1 font-bold transition hover:ring-2 hover:ring-emerald-400 ${style}`}>{label}</button></td>; })}<td className="px-3 text-center font-bold">{present}/{days}</td><td className="px-3 text-center font-bold">{loading ? "—" : num(leaveBalance)}</td><td className="px-3 text-center font-bold">{loading ? "—" : num(phBalance)}</td></tr>; })}</tbody></table>{!filteredEmployees.length && <div className="p-8 text-center text-sm text-slate-500">Tidak ada karyawan sesuai filter.</div>}</div><div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500 dark:border-slate-800"><span>H = Hadir</span><span>T = Terlambat</span><span>C = Cuti disetujui</span><span>PH = Pengganti hari libur disetujui</span><span>I = Izin disetujui</span><span>S = Sakit disetujui</span><span>J = Jadwal</span><span>½ = Setengah hari</span><span>OFF = Libur</span><span className="ml-auto">{filteredEmployees.length} staff</span></div></div>
    <div className="grid gap-3 md:grid-cols-2"><button onClick={() => openNewSchedule()} className={`${cardClass} flex items-center gap-3 p-4 text-left transition hover:border-emerald-300 hover:shadow-md`}><span className="rounded-xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"><CalendarDays size={20}/></span><span><b className="block text-sm">Jadwal Bulanan</b><small className="text-slate-500">Shift, libur mingguan, setengah hari</small></span><Plus className="ml-auto" size={17}/></button><button onClick={openRequestForm} className={`${cardClass} flex items-center gap-3 p-4 text-left transition hover:border-violet-300 hover:shadow-md`}><span className="rounded-xl bg-violet-50 p-3 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"><ClipboardCheck size={20}/></span><span><b className="block text-sm">Pengajuan Cuti / PH / Lembur</b><small className="text-slate-500">Buat dan pantau persetujuan</small></span><Plus className="ml-auto" size={17}/></button></div></div>
    <aside className="space-y-4"><div className={`${cardClass} p-4`}><div className="mb-1 flex items-center justify-between"><div className="flex items-center gap-2"><Wallet size={17} className="text-emerald-600"/><h3 className="font-bold">Saldo Cuti & PH</h3></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-800">{year}</span></div><p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Saldo tahunan dihitung oleh API saldo.</p><div className="max-h-80 space-y-3 overflow-y-auto">{filteredEmployees.map((emp) => { const b = balanceMap.get(emp.id); const leave = b?.leaveBalance ?? (b?.entitlement ?? 12); const ph = b?.phBalance ?? ((b?.phEarned ?? 0) - (b?.phUsed ?? 0)); return <div key={emp.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"><div className="flex items-center justify-between gap-2"><div className="truncate text-sm font-bold">{emp.name}</div><button type="button" onClick={() => { const current=balanceMap.get(emp.id); setEditingBalanceId(editingBalanceId===emp.id?null:emp.id); setBalanceDraft({ entitlement:String(current?.leaveBalance??current?.entitlement??12), phAdjustment:String(current?.phAdjustment??0) }); }} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold dark:border-slate-700">{editingBalanceId===emp.id?"Tutup":"Edit saldo"}</button></div>{editingBalanceId===emp.id && <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-900"><label className="block text-xs font-semibold">Sisa cuti (saldo yang ingin ditetapkan)<input type="number" min="0" max="366" step="0.5" value={balanceDraft.entitlement} onChange={e=>setBalanceDraft(v=>({...v,entitlement:e.target.value}))} className={inputClass}/></label><label className="block text-xs font-semibold">Penyesuaian saldo PH (+/-)<input type="number" min="-366" max="366" step="0.5" value={balanceDraft.phAdjustment} onChange={e=>setBalanceDraft(v=>({...v,phAdjustment:e.target.value}))} className={inputClass}/></label><button type="button" disabled={saving} onClick={()=>void saveBalance(emp.id)} className="w-full rounded-lg bg-[#145c50] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Save size={13} className="mr-1 inline"/>{saving?"Menyimpan…":"Simpan saldo"}</button></div>}<div className="mt-2 grid grid-cols-2 gap-2"><div className="rounded-lg bg-emerald-50 p-2.5 dark:bg-emerald-950/40"><div className="text-[10px] text-slate-500">Sisa Cuti</div><div className="text-xl font-black text-emerald-800 dark:text-emerald-200">{loading ? "—" : num(leave)}</div><div className="text-[10px] text-slate-500">Terpakai: {num(b?.leaveUsed ?? 0)}</div></div><div className="rounded-lg bg-violet-50 p-2.5 dark:bg-violet-950/40"><div className="text-[10px] text-slate-500">Sisa PH</div><div className="text-xl font-black text-violet-800 dark:text-violet-200">{loading ? "—" : num(ph)}</div><div className="text-[10px] text-slate-500">Diperoleh: {num(b?.phEarned ?? 0)} · Pakai: {num(b?.phUsed ?? 0)}</div></div></div></div>; })}{!filteredEmployees.length && <p className="py-5 text-center text-sm text-slate-500">Tidak ada karyawan.</p>}</div></div>
    <div className={`${cardClass} p-4`}><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">Ringkasan Bulan</h3><CalendarDays size={17} className="text-emerald-600"/></div><div className="grid grid-cols-7 gap-1 text-center">{weekDays.map((w) => <span key={w} className="py-1 text-[10px] font-semibold text-slate-400">{w}</span>)}{Array.from({ length: offset }, (_, i) => <span key={`blank${i}`}/>)}{Array.from({ length: days }, (_, i) => { const date = new Date(year, month.getMonth(), i + 1); const key = keyDate(date); const isToday = key === todayKey; const daySchedules = schedules.filter((s) => dateOnly(s.workDate) === key); const offCount = daySchedules.filter((s) => isOff(s)).length; return <button key={i} title={`${daySchedules.length} jadwal, ${offCount} libur`} onClick={() => openNewSchedule(key)} className={`aspect-square rounded-lg text-xs transition hover:ring-2 hover:ring-emerald-400 ${isToday ? "bg-[#145c50] font-bold text-white" : offCount ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" : daySchedules.length ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200" : "bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300"}`}>{i + 1}</button>; })}</div><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>Tanggal dengan jadwal</span><b>{scheduleDays} hari</b></div></div>
    <div className={`${cardClass} p-4`}><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">Pengajuan Terbaru</h3><button onClick={openRequestForm} className="text-xs font-bold text-emerald-700 dark:text-emerald-300">+ Buat</button></div><div className="space-y-3">{requests.slice(0, 6).map((r) => <div key={r.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-slate-800"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-semibold">{r.employee?.name || `Staff #${r.employeeId}`}</div><div className="mt-0.5 text-xs text-slate-500">{({ CUTI: "Cuti (C)", PH: "PH", I: "Izin (I)", IZIN: "Izin (I)", S: "Sakit (S)", SAKIT: "Sakit (S)", LEMBUR: "Lembur" } as Record<string, string>)[String(r.type).toUpperCase()] || r.type} · {dateText(r.startDate)}{dateOnly(r.endDate) !== dateOnly(r.startDate) ? ` – ${dateText(r.endDate)}` : ""}</div><p className="mt-1 line-clamp-2 text-xs text-slate-500">{r.reason}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${r.status === "APPROVED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200" : r.status === "REJECTED" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200" : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"}`}>{r.status === "APPROVED" ? "Disetujui" : r.status === "REJECTED" ? "Ditolak" : "Pending"}</span><button type="button" title="Hapus pengajuan" disabled={deletingRequestId === r.id} onClick={() => void deleteRequest(r.id)} className="ml-1 rounded-lg border border-rose-200 p-1.5 text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300"><X size={13}/></button></div>{r.status === "PENDING" && <div className="mt-2 flex gap-2"><button disabled={decidingId === r.id} onClick={() => void decideRequest(r.id, "APPROVED")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"><Check size={12}/>{decidingId === r.id ? "Memproses…" : "Setujui"}</button><button disabled={decidingId === r.id} onClick={() => void decideRequest(r.id, "REJECTED")} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-50 dark:border-slate-700"><CircleX size={12}/>Tolak</button></div>}</div>)}{!requests.length && <p className="py-5 text-center text-sm text-slate-500">Belum ada pengajuan.</p>}</div></div>
    <div className={`${cardClass} p-4`}><h3 className="mb-3 font-bold">Aturan Absensi</h3><div className="space-y-3 text-xs text-slate-600 dark:text-slate-300"><p className="flex gap-2"><Clock3 size={15} className="shrink-0 text-emerald-600"/>Jam masuk mengikuti jadwal shift.</p><p className="flex gap-2"><Timer size={15} className="shrink-0 text-emerald-600"/>Durasi kerja mengikuti jadwal tersimpan.</p><p className="flex gap-2"><Check size={15} className="shrink-0 text-emerald-600"/>Status terlambat mengikuti aturan API absensi.</p><p className="flex gap-2"><CalendarOff size={15} className="shrink-0 text-emerald-600"/>Bekerja pada jadwal OFF dapat menghasilkan PH.</p><p className="flex gap-2"><BriefcaseBusiness size={15} className="shrink-0 text-emerald-600"/>Saldo mengikuti pengajuan yang sudah disetujui.</p></div></div></aside></section></div>

    {scheduleOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"><form onSubmit={saveSchedule} className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-[#111c2d] sm:p-6"><div className="flex items-start justify-between gap-3"><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-700 dark:text-emerald-300">Manajemen jadwal</div><h2 className="text-lg font-black">{editingSchedule ? "Edit Jadwal Kerja" : "Buat Jadwal Kerja"}</h2><p className="text-xs text-slate-500">Atur shift per tanggal atau buat jadwal dalam rentang bulan.</p></div><button type="button" onClick={() => { setScheduleOpen(false); setEditingSchedule(null); }} aria-label="Tutup" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20}/></button></div>
    {!editingSchedule && <div className="grid grid-cols-3 gap-2">{([{ value: "MONTHLY", label: "Sebulan" }, { value: "RANGE", label: "Rentang" }, { value: "SINGLE", label: "Satu Hari" }] as const).map((m) => <button key={m.value} type="button" onClick={() => setScheduleForm((v) => ({ ...v, mode: m.value, ...(m.value === "MONTHLY" ? { startDate: monthStart, endDate: monthEnd } : {}) }))} className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${scheduleForm.mode === m.value ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"}`}>{m.label}</button>)}</div>}
    <label className="block text-sm font-semibold">Karyawan<select required disabled={Boolean(editingSchedule)} value={scheduleForm.employeeId} onChange={(e) => { const emp = activeEmployees.find((x) => String(x.id) === e.target.value); const admin = /admin/i.test(emp?.position || ""); setScheduleForm((v) => ({ ...v, employeeId: e.target.value, ...(admin ? { shiftName: "Admin", startTime: "09:00", endTime: "18:00", workHours: "9" } : {}) })); }} className={inputClass}><option value="">Pilih karyawan</option>{activeEmployees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name} · {emp.position || emp.nik}</option>)}</select></label>
    <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Tanggal mulai<input type="date" required value={scheduleForm.startDate} onChange={(e) => setScheduleForm((v) => ({ ...v, startDate: e.target.value, ...(v.mode === "SINGLE" ? { endDate: e.target.value } : {}) }))} className={inputClass}/></label><label className="text-sm font-semibold">Tanggal akhir<input type="date" required min={scheduleForm.startDate} disabled={scheduleForm.mode === "SINGLE"} value={scheduleForm.endDate} onChange={(e) => setScheduleForm((v) => ({ ...v, endDate: e.target.value }))} className={`${inputClass} disabled:opacity-50`}/></label></div>
    {!editingSchedule && scheduleForm.mode !== "SINGLE" && <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><div><h3 className="text-sm font-bold">Pengaturan Mingguan</h3><p className="mt-1 text-xs text-slate-500">Default Minggu libur dan Sabtu setengah hari. Hari libur dan setengah hari tidak dapat dipilih bersamaan.</p></div><div><p className="mb-2 text-xs font-bold">Hari libur</p><div className="grid grid-cols-4 gap-2 sm:grid-cols-7">{weekDays.map((d, i) => <label key={d} className={`flex cursor-pointer items-center justify-center gap-1 rounded-lg border p-2 text-xs ${scheduleForm.offDays.includes(i) ? "border-slate-500 bg-slate-200 font-bold dark:bg-slate-700" : "border-slate-200 dark:border-slate-700"}`}><input type="checkbox" checked={scheduleForm.offDays.includes(i)} onChange={(e) => toggleDay("offDays", i, e.target.checked)} className="accent-emerald-700"/>{d}</label>)}</div></div><div><p className="mb-2 text-xs font-bold">Setengah hari</p><div className="grid grid-cols-4 gap-2 sm:grid-cols-7">{weekDays.map((d, i) => <label key={d} className={`flex cursor-pointer items-center justify-center gap-1 rounded-lg border p-2 text-xs ${scheduleForm.halfDays.includes(i) ? "border-amber-400 bg-amber-100 font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200" : "border-slate-200 dark:border-slate-700"}`}><input type="checkbox" checked={scheduleForm.halfDays.includes(i)} onChange={(e) => toggleDay("halfDays", i, e.target.checked)} className="accent-amber-600"/>{d}</label>)}</div></div><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold">Masuk setengah hari<input type="time" required value={scheduleForm.halfDayStart} onChange={(e) => setScheduleForm((v) => ({ ...v, halfDayStart: e.target.value }))} className={inputClass}/></label><label className="text-xs font-semibold">Pulang setengah hari<input type="time" required value={scheduleForm.halfDayEnd} onChange={(e) => setScheduleForm((v) => ({ ...v, halfDayEnd: e.target.value }))} className={inputClass}/></label><label className="text-xs font-semibold">Durasi (jam)<input type="number" min="0.5" max="24" step="0.5" required value={scheduleForm.halfDayHours} onChange={(e) => setScheduleForm((v) => ({ ...v, halfDayHours: e.target.value }))} className={inputClass}/></label></div></div>}
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><h3 className="mb-3 text-sm font-bold">{editingSchedule ? "Edit Shift" : "Shift Hari Kerja"}</h3><label className="block text-sm font-semibold">Jenis shift<select value={scheduleForm.shiftName} onChange={(e) => changeShift(e.target.value)} className={inputClass}><option value="Admin">Admin</option><option value="Morning">Morning</option><option value="Middle">Middle</option><option value="Evening">Evening</option><option value="Custom">Custom</option><option value="Half Day">Half Day / Setengah Hari</option><option value="OFF">OFF / Libur</option></select></label>{scheduleForm.shiftName.toUpperCase() === "OFF" ? <p className="mt-3 rounded-xl bg-slate-100 p-3 text-xs dark:bg-slate-800">Tanggal ini ditandai sebagai libur. Jadwal pada tanggal yang sama diperbarui, bukan digandakan.</p> : <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"><label className="text-xs font-semibold">Jam masuk<input type="time" required value={scheduleForm.startTime} onChange={(e) => setScheduleForm((v) => ({ ...v, startTime: e.target.value }))} className={inputClass}/></label><label className="text-xs font-semibold">Jam pulang<input type="time" value={scheduleForm.endTime} onChange={(e) => setScheduleForm((v) => ({ ...v, endTime: e.target.value }))} className={inputClass}/></label><label className="text-xs font-semibold">Durasi (jam)<input type="number" min="0.5" max="24" step="0.5" required value={scheduleForm.workHours} onChange={(e) => setScheduleForm((v) => ({ ...v, workHours: e.target.value }))} className={inputClass}/></label></div>}</div><div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">Perubahan jadwal tidak menghapus record absensi yang sudah ada.</div><div className="flex justify-end gap-2"><button type="button" onClick={() => { setScheduleOpen(false); setEditingSchedule(null); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-slate-700">Batal</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#145c50] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#10483f] disabled:opacity-50"><Save size={16}/>{saving ? "Menyimpan…" : editingSchedule ? "Simpan Perubahan" : "Simpan Jadwal"}</button></div></form></div>}

    {requestOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"><form onSubmit={submitRequest} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-[#111c2d] sm:p-6"><div className="flex items-center justify-between"><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-violet-700 dark:text-violet-300">Workflow HR</div><h2 className="text-lg font-black">Pengajuan Staff</h2><p className="text-xs text-slate-500">Pengajuan baru menunggu persetujuan.</p></div><button type="button" onClick={() => setRequestOpen(false)} aria-label="Tutup" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20}/></button></div><label className="block text-sm font-semibold">Karyawan<select required value={requestForm.employeeId} onChange={(e) => setRequestForm((v) => ({ ...v, employeeId: e.target.value }))} className={inputClass}><option value="">Pilih karyawan</option>{activeEmployees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name} · {emp.position || emp.nik}</option>)}</select></label><label className="block text-sm font-semibold">Jenis pengajuan<select value={requestForm.type} onChange={(e) => setRequestForm((v) => ({ ...v, type: e.target.value }))} className={inputClass}><option value="CUTI">Cuti (C)</option><option value="PH">PH (Pengganti Hari Libur)</option><option value="I">Izin (I)</option><option value="S">Sakit (S)</option><option value="LEMBUR">Lembur</option></select></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Tanggal mulai<input type="date" required value={requestForm.startDate} onChange={(e) => setRequestForm((v) => ({ ...v, startDate: e.target.value, ...(v.endDate < e.target.value ? { endDate: e.target.value } : {}) }))} className={inputClass}/></label><label className="text-sm font-semibold">Tanggal akhir<input type="date" required min={requestForm.startDate} value={requestForm.endDate} onChange={(e) => setRequestForm((v) => ({ ...v, endDate: e.target.value }))} className={inputClass}/></label></div>{requestForm.type === "LEMBUR" && <label className="block text-sm font-semibold">Durasi lembur (jam)<input type="number" min="0.5" max="24" step="0.5" required value={requestForm.requestedHours} onChange={(e) => setRequestForm((v) => ({ ...v, requestedHours: e.target.value }))} className={inputClass}/></label>}<label className="block text-sm font-semibold">Alasan<textarea required rows={3} value={requestForm.reason} onChange={(e) => setRequestForm((v) => ({ ...v, reason: e.target.value }))} className={inputClass} placeholder="Jelaskan alasan pengajuan…"/></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setRequestOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-slate-700">Batal</button><button disabled={saving} className="rounded-xl bg-[#145c50] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#10483f] disabled:opacity-50">{saving ? "Mengirim…" : "Kirim Pengajuan"}</button></div></form></div>}
  </main>;
}
