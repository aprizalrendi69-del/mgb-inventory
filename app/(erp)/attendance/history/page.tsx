
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  UserCheck,
  Users,
  XCircle,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Image as ImageIcon,
  CalendarRange,
  Timer,
  Building2,
  Download,
  Eye,
  RotateCcw,
  ArrowUpRight,
} from "lucide-react";

type Employee = {
  id: string | number;
  name?: string | null;
  department?: string | null;
};

type Attendance = {
  id: string | number;
  date?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  photoIn?: string | null;
  photoOut?: string | null;
  late?: boolean | null;
  employee?: Employee | null;
};

type AttendancePhoto = {
  src: string;
  title: string;
  employee: string;
  department: string;
  date: string;
  time: string;
  attendanceId: string | number;
};

const C = {
  green: "#497F70",
  dark: "#18352D",
  pale: "#EAF3EF",
  border: "#DDE9E4",
};

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function initials(name?: string | null) {
  if (!name) return "??";

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function number(value: number) {
  return value.toLocaleString("id-ID");
}

const inputClass =
  "w-full min-w-0 rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-3.5 py-3 text-sm text-[#18352D] outline-none transition placeholder:text-gray-400 focus:border-[#497F70] focus:bg-white focus:ring-4 focus:ring-[#497F70]/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800";

const panelClass =
  "rounded-2xl border border-[#DDE9E4] bg-white shadow-[0_4px_20px_rgba(24,53,45,0.035)] dark:border-slate-700 dark:bg-slate-900";

export default function AttendanceHistory() {
  const [data, setData] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [employeeId, setEmployeeId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingEmployee, setLoadingEmployee] = useState(true);
  const [error, setError] = useState("");

  const [selectedPhoto, setSelectedPhoto] =
    useState<AttendancePhoto | null>(null);

  const [imageError, setImageError] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const loadEmployee = useCallback(async () => {
    try {
      setLoadingEmployee(true);

      const res = await fetch("/api/employee", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Gagal mengambil daftar karyawan.");
      }

      const json = await res.json();

      if (json.success) {
        setEmployees(json.data ?? []);
      } else {
        setEmployees([]);
      }
    } catch (err) {
      console.error("LOAD EMPLOYEE ERROR:", err);
      setEmployees([]);
    } finally {
      setLoadingEmployee(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (employeeId) params.set("employeeId", employeeId);
      if (start) params.set("start", start);
      if (end) params.set("end", end);

      const query = params.toString();
      const url = query
        ? `/api/attendance/history?${query}`
        : "/api/attendance/history";

      const res = await fetch(url, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Gagal mengambil riwayat absensi.");
      }

      const json = await res.json();

      if (json.success) {
        setData(json.data ?? []);
      } else {
        setData([]);
        setError(json.message || "Riwayat absensi gagal dimuat.");
      }
    } catch (err) {
      console.error("LOAD ATTENDANCE ERROR:", err);
      setData([]);
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengambil data.",
      );
    } finally {
      setLoading(false);
    }
  }, [employeeId, start, end]);

  useEffect(() => {
    void loadEmployee();
  }, [loadEmployee]);

  useEffect(() => {
    void load();
  }, [load]);

  const photos: AttendancePhoto[] = data.flatMap((item) => {
    const result: AttendancePhoto[] = [];
    const employee = item.employee?.name || "Karyawan";
    const department = item.employee?.department || "-";
    const date = formatDate(item.date);

    if (item.photoIn) {
      result.push({
        src: item.photoIn,
        title: "Foto Check In",
        employee,
        department,
        date,
        time: formatTime(item.checkIn),
        attendanceId: item.id,
      });
    }

    if (item.photoOut) {
      result.push({
        src: item.photoOut,
        title: "Foto Check Out",
        employee,
        department,
        date,
        time: formatTime(item.checkOut),
        attendanceId: item.id,
      });
    }

    return result;
  });

  const selectedPhotoIndex = selectedPhoto
    ? photos.findIndex(
        (photo) =>
          photo.attendanceId === selectedPhoto.attendanceId &&
          photo.title === selectedPhoto.title,
      )
    : -1;

  const selesai = data.filter((item) => Boolean(item.checkOut)).length;
  const belumPulang = data.filter((item) => !item.checkOut).length;
  const terlambat = data.filter((item) => Boolean(item.late)).length;

  function openPhoto(photo: AttendancePhoto) {
    setImageError(false);
    setSelectedPhoto(photo);
  }

  function closePhoto() {
    setSelectedPhoto(null);
    setImageError(false);
  }

  function movePhoto(direction: number) {
    if (!photos.length) return;

    const current = selectedPhoto
      ? photos.findIndex(
          (photo) =>
            photo.attendanceId === selectedPhoto.attendanceId &&
            photo.title === selectedPhoto.title,
        )
      : -1;

    const next = (current + direction + photos.length) % photos.length;

    setImageError(false);
    setSelectedPhoto(photos[next]);
  }

  useEffect(() => {
    if (!selectedPhoto) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closePhoto();
      if (event.key === "ArrowLeft") movePhoto(-1);
      if (event.key === "ArrowRight") movePhoto(1);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedPhoto, photos]);

  async function downloadPhoto() {
    if (!selectedPhoto) return;

    try {
      const res = await fetch(selectedPhoto.src);

      if (!res.ok) throw new Error("Unduhan foto gagal.");

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = objectUrl;
      anchor.download = `absensi-${String(
        selectedPhoto.attendanceId,
      )}-${selectedPhoto.title.toLowerCase().replace(/\s+/g, "-")}.jpg`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      console.error("DOWNLOAD PHOTO ERROR:", err);
      window.open(selectedPhoto.src, "_blank", "noopener,noreferrer");
    }
  }

  function resetFilters() {
    setEmployeeId("");
    setStart("");
    setEnd("");
  }

  function renderPhoto(
    src: string | null | undefined,
    attendance: Attendance,
    title: string,
    time?: string | null,
  ) {
    if (!src) {
      return (
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-[#DDE9E4] bg-[#F7FAF8] text-slate-400 dark:border-slate-700 dark:bg-slate-800">
            <Camera size={19} />
          </div>
          <span className="text-[10px] text-slate-400">Tidak tersedia</span>
        </div>
      );
    }

    const photo: AttendancePhoto = {
      src,
      title,
      employee: attendance.employee?.name || "Karyawan",
      department: attendance.employee?.department || "-",
      date: formatDate(attendance.date),
      time: formatTime(time),
      attendanceId: attendance.id,
    };

    return (
      <button
        type="button"
        onClick={() => openPhoto(photo)}
        title={`Klik untuk melihat ${title.toLowerCase()}`}
        aria-label={`Lihat ${title} ${photo.employee}`}
        className="group relative mx-auto block overflow-hidden rounded-xl border border-[#DDE9E4] bg-[#F1F6F3] shadow-sm outline-none transition duration-300 hover:-translate-y-0.5 hover:border-[#497F70] hover:shadow-lg hover:shadow-[#18352D]/10 focus-visible:ring-4 focus-visible:ring-[#497F70]/25 dark:border-slate-700 dark:bg-slate-800"
      >
        <img
          src={src}
          alt={`${title} - ${photo.employee}`}
          loading="lazy"
          className="h-14 w-14 object-cover transition duration-300 group-hover:scale-110 sm:h-16 sm:w-16"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-[#18352D]/0 text-white transition duration-200 group-hover:bg-[#18352D]/50">
          <ZoomIn
            size={23}
            className="scale-75 opacity-0 transition duration-200 group-hover:scale-100 group-hover:opacity-100"
          />
        </span>
        <span className="absolute bottom-1 right-1 rounded-md bg-[#18352D]/75 p-1 text-white">
          <Eye size={11} />
        </span>
      </button>
    );
  }

  const summaryCards = [
    {
      label: "Total Absensi",
      value: data.length,
      description: "Catatan sesuai filter",
      icon: Users,
      iconBg: "bg-[#EAF3EF] dark:bg-emerald-500/10",
      iconColor: "text-[#497F70] dark:text-emerald-400",
      line: "bg-[#497F70]",
    },
    {
      label: "Sudah Pulang",
      value: selesai,
      description: "Check-out tercatat",
      icon: CheckCircle2,
      iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      line: "bg-emerald-500",
    },
    {
      label: "Belum Pulang",
      value: belumPulang,
      description: "Masih aktif / belum checkout",
      icon: XCircle,
      iconBg: "bg-rose-50 dark:bg-rose-500/10",
      iconColor: "text-rose-600 dark:text-rose-400",
      line: "bg-rose-500",
    },
    {
      label: "Terlambat",
      value: terlambat,
      description: "Ditandai terlambat",
      icon: Clock3,
      iconBg: "bg-amber-50 dark:bg-amber-500/10",
      iconColor: "text-amber-600 dark:text-amber-400",
      line: "bg-amber-500",
    },
  ];

  return (
    <div className="min-h-full bg-[#F5F8F6] px-4 py-5 text-[#18352D] sm:px-6 sm:py-7 lg:px-8 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-[1600px]">
        {/* HEADER */}
        <header className="relative mb-7 overflow-hidden rounded-3xl border border-[#DDE9E4] bg-white shadow-[0_8px_35px_rgba(24,53,45,0.055)] dark:border-slate-700 dark:bg-slate-900">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-[#497F70]" />
          <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full bg-[#EAF3EF]/80 blur-3xl dark:bg-emerald-950/40" />
          <div className="pointer-events-none absolute -bottom-20 right-1/4 h-40 w-40 rounded-full bg-[#497F70]/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#18352D] text-white shadow-lg shadow-[#18352D]/15 sm:h-16 sm:w-16">
                <CalendarDays size={28} strokeWidth={1.8} />
              </div>

              <div className="min-w-0 pt-0.5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#D5E5DC] bg-[#EAF3EF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#497F70] dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Human Resources
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Attendance Management
                  </span>
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-[#18352D] sm:text-3xl lg:text-[34px] dark:text-white">
                  Riwayat Absensi
                </h1>
                <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Pantau kehadiran, waktu kerja, keterlambatan, dan bukti foto
                  check-in maupun check-out karyawan.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              <div className="mr-1 hidden items-center gap-2 rounded-xl border border-[#DDE9E4] bg-[#FAFCFB] px-3.5 py-2.5 sm:flex dark:border-slate-700 dark:bg-slate-800">
                <CalendarRange size={17} className="text-[#497F70]" />
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    Data ditampilkan
                  </p>
                  <p className="text-xs font-bold text-[#18352D] dark:text-slate-100">
                    {number(data.length)} catatan
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  void loadEmployee();
                  void load();
                }}
                disabled={loading || loadingEmployee}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm font-semibold text-[#35564C] shadow-sm transition hover:border-[#497F70] hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <RefreshCw
                  size={16}
                  className={loading || loadingEmployee ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>
          </div>

          <div className="relative grid grid-cols-3 border-t border-[#E7EFEB] bg-[#FAFCFB]/80 dark:border-slate-700 dark:bg-slate-900/80">
            <div className="px-4 py-3.5 sm:px-7">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Karyawan
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm font-bold text-[#18352D] dark:text-slate-100">
                <Users size={15} className="text-[#497F70]" />
                {loadingEmployee ? "Memuat..." : number(employees.length)}
              </p>
            </div>
            <div className="border-x border-[#E7EFEB] px-4 py-3.5 sm:px-7 dark:border-slate-700">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Foto Tersedia
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm font-bold text-[#18352D] dark:text-slate-100">
                <Camera size={15} className="text-[#497F70]" />
                {number(photos.length)}
              </p>
            </div>
            <div className="px-4 py-3.5 sm:px-7">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Status Data
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm font-bold text-[#497F70] dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {loading ? "Memuat data" : error ? "Perlu diperiksa" : "Terhubung"}
              </p>
            </div>
          </div>
        </header>

        {/* SUMMARY */}
        <section className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.label}
                className={`group relative overflow-hidden ${panelClass} p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#18352D]/5`}
              >
                <div className={`absolute inset-y-0 left-0 w-1 ${card.line}`} />

                <div className="flex items-start justify-between gap-3 pl-1">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {card.label}
                    </p>
                    <p className="mt-2 text-3xl font-extrabold tracking-tight text-[#18352D] dark:text-white">
                      {loading ? (
                        <span className="inline-block h-9 w-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                      ) : (
                        number(card.value)
                      )}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {card.description}
                    </p>
                  </div>

                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${card.iconBg} ${card.iconColor} transition duration-300 group-hover:scale-105`}>
                    <Icon size={23} strokeWidth={1.8} />
                  </div>
                </div>

                <div className="mt-5 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${card.line} transition-all duration-500`}
                    style={{
                      width:
                        data.length > 0
                          ? `${Math.min(100, (card.value / data.length) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </section>

        {/* FILTER */}
        <section className={`${panelClass} mb-7 overflow-hidden`}>
          <div className="flex items-center gap-3 border-b border-[#E7EFEB] px-5 py-4 sm:px-6 dark:border-slate-700">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70] dark:bg-emerald-500/10 dark:text-emerald-400">
              <Search size={19} />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-[#18352D] dark:text-white">
                Filter Absensi
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Tentukan karyawan dan rentang tanggal untuk mencari data.
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_auto_auto] xl:items-end">
              <label className="block min-w-0">
                <span className="mb-2 flex items-center gap-2 text-xs font-bold text-[#35564C] dark:text-slate-300">
                  <UserCheck size={15} className="text-[#497F70]" />
                  Karyawan
                </span>
                <select
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  disabled={loadingEmployee}
                  className={inputClass}
                >
                  <option value="">
                    {loadingEmployee ? "Memuat karyawan..." : "Semua Karyawan"}
                  </option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name || `Karyawan ${employee.id}`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block min-w-0">
                <span className="mb-2 flex items-center gap-2 text-xs font-bold text-[#35564C] dark:text-slate-300">
                  <CalendarDays size={15} className="text-[#497F70]" />
                  Dari Tanggal
                </span>
                <input
                  type="date"
                  value={start}
                  max={end || undefined}
                  onChange={(event) => setStart(event.target.value)}
                  className={inputClass}
                />
              </label>

              <label className="block min-w-0">
                <span className="mb-2 flex items-center gap-2 text-xs font-bold text-[#35564C] dark:text-slate-300">
                  <CalendarDays size={15} className="text-[#497F70]" />
                  Sampai Tanggal
                </span>
                <input
                  type="date"
                  value={end}
                  min={start || undefined}
                  onChange={(event) => setEnd(event.target.value)}
                  className={inputClass}
                />
              </label>

              <button
                type="button"
                onClick={() => void load()}
                disabled={loading || loadingEmployee || (!!start && !!end && start > end)}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#497F70] px-5 py-3 text-sm font-bold text-white shadow-md shadow-[#497F70]/15 transition hover:bg-[#3E6E61] hover:shadow-lg hover:shadow-[#497F70]/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw size={17} className="animate-spin" />
                ) : (
                  <Search size={17} />
                )}
                Cari Absensi
              </button>

              <button
                type="button"
                onClick={resetFilters}
                disabled={loading || (!employeeId && !start && !end)}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm font-semibold text-[#497F70] transition hover:bg-[#EAF3EF] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-emerald-400 dark:hover:bg-slate-700"
              >
                <RotateCcw size={16} />
                Reset
              </button>
            </div>

            {!!start && !!end && start > end && (
              <p className="mt-3 text-xs font-medium text-rose-600">
                Tanggal awal tidak boleh melebihi tanggal akhir.
              </p>
            )}

            {(employeeId || start || end) && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#EDF2EF] pt-4 dark:border-slate-700">
                <span className="text-xs text-slate-400">Filter aktif:</span>
                {employeeId && (
                  <span className="rounded-full bg-[#EAF3EF] px-3 py-1 text-xs font-semibold text-[#497F70] dark:bg-emerald-950/40 dark:text-emerald-300">
                    {employees.find((item) => String(item.id) === employeeId)?.name ||
                      "Karyawan dipilih"}
                  </span>
                )}
                {start && (
                  <span className="rounded-full bg-[#EAF3EF] px-3 py-1 text-xs font-semibold text-[#497F70] dark:bg-emerald-950/40 dark:text-emerald-300">
                    Dari {formatDate(start)}
                  </span>
                )}
                {end && (
                  <span className="rounded-full bg-[#EAF3EF] px-3 py-1 text-xs font-semibold text-[#497F70] dark:bg-emerald-950/40 dark:text-emerald-300">
                    Sampai {formatDate(end)}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ATTENDANCE TABLE */}
        <section className={`${panelClass} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-[#E7EFEB] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#18352D] text-white">
                <CalendarRange size={21} />
              </div>
              <div>
                <h2 className="font-bold text-[#18352D] dark:text-white">
                  Detail Kehadiran
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Waktu masuk, foto bukti, dan status kepulangan.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl border border-[#DDE9E4] bg-[#FAFCFB] px-3 py-2 text-xs font-semibold text-[#35564C] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <ImageIcon size={15} className="text-[#497F70]" />
                {number(photos.length)} foto
              </span>
              <span className="rounded-xl bg-[#EAF3EF] px-3 py-2 text-xs font-bold text-[#497F70] dark:bg-emerald-950/40 dark:text-emerald-300">
                {number(data.length)} data
              </span>
            </div>
          </div>

          {error && (
            <div className="mx-5 mt-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 sm:mx-6 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              <XCircle size={19} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-bold">Gagal memuat riwayat absensi</p>
                <p className="mt-1">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="shrink-0 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40"
              >
                Coba lagi
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-[#DDE9E4] bg-[#F5F8F6] dark:border-slate-700 dark:bg-slate-800/80">
                  <th className="px-5 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-[#527267]">
                    Tanggal
                  </th>
                  <th className="px-5 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-[#527267]">
                    Karyawan
                  </th>
                  <th className="px-4 py-4 text-center text-[11px] font-extrabold uppercase tracking-wider text-[#527267]">
                    Check In
                  </th>
                  <th className="px-4 py-4 text-center text-[11px] font-extrabold uppercase tracking-wider text-[#527267]">
                    Foto In
                  </th>
                  <th className="px-4 py-4 text-center text-[11px] font-extrabold uppercase tracking-wider text-[#527267]">
                    Check Out
                  </th>
                  <th className="px-4 py-4 text-center text-[11px] font-extrabold uppercase tracking-wider text-[#527267]">
                    Foto Out
                  </th>
                  <th className="px-5 py-4 text-center text-[11px] font-extrabold uppercase tracking-wider text-[#527267]">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#EDF2EF] dark:divide-slate-800">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-5 py-20 text-center">
                      <div className="flex flex-col items-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3EF] text-[#497F70] dark:bg-emerald-950/40 dark:text-emerald-400">
                          <RefreshCw size={25} className="animate-spin" />
                        </div>
                        <p className="mt-4 font-bold text-[#18352D] dark:text-white">
                          Memuat riwayat absensi
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Mohon tunggu sebentar...
                        </p>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-20 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#DDE9E4] bg-[#F5F8F6] text-[#497F70] dark:border-slate-700 dark:bg-slate-800">
                          <CalendarDays size={29} strokeWidth={1.7} />
                        </div>
                        <h3 className="mt-5 font-bold text-[#18352D] dark:text-white">
                          Belum ada riwayat absensi
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          Tidak ada data yang cocok dengan filter saat ini.
                          Coba ubah periode atau pilih semua karyawan.
                        </p>
                        {(employeeId || start || end) && (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#3E6E61]"
                          >
                            <RotateCcw size={15} />
                            Reset Filter
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}

                {!loading &&
                  data.map((attendance) => (
                    <tr
                      key={attendance.id}
                      className="group transition-colors hover:bg-[#F7FAF8] dark:hover:bg-slate-800/60"
                    >
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70] dark:bg-emerald-950/40 dark:text-emerald-400">
                            <CalendarDays size={17} />
                          </div>
                          <div>
                            <p className="font-bold text-[#18352D] dark:text-slate-100">
                              {formatDate(attendance.date)}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-400">
                              ID #{attendance.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D5E5DC] bg-gradient-to-br from-[#EAF3EF] to-[#D7E8DF] text-xs font-extrabold text-[#35564C] dark:border-slate-700 dark:from-slate-700 dark:to-slate-800 dark:text-emerald-300">
                            {initials(attendance.employee?.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="max-w-[200px] truncate font-bold text-[#18352D] dark:text-slate-100">
                              {attendance.employee?.name || "-"}
                            </p>
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                              <Building2 size={12} />
                              {attendance.employee?.department || "-"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center">
                        {attendance.checkIn ? (
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 font-bold tabular-nums text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <Clock3 size={13} />
                              {formatTime(attendance.checkIn)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Waktu masuk
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-center">
                        {renderPhoto(
                          attendance.photoIn,
                          attendance,
                          "Foto Check In",
                          attendance.checkIn,
                        )}
                      </td>

                      <td className="px-4 py-4 text-center">
                        {attendance.checkOut ? (
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-100 bg-sky-50 px-2.5 py-1.5 font-bold tabular-nums text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
                              <Clock3 size={13} />
                              {formatTime(attendance.checkOut)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Waktu pulang
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-center">
                        {renderPhoto(
                          attendance.photoOut,
                          attendance,
                          "Foto Check Out",
                          attendance.checkOut,
                        )}
                      </td>

                      <td className="px-5 py-4 text-center">
                        <div className="flex flex-col items-center gap-2">
                          {attendance.checkOut ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <CheckCircle2 size={13} />
                              Selesai
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-100 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                              <XCircle size={13} />
                              Belum Pulang
                            </span>
                          )}

                          {attendance.late && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                              <Timer size={12} />
                              Terlambat
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* TABLE FOOTER */}
          <div className="flex flex-col gap-2 border-t border-[#E7EFEB] bg-[#FAFCFB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs text-slate-400">
              Menampilkan{" "}
              <span className="font-bold text-[#35564C] dark:text-slate-200">
                {number(data.length)}
              </span>{" "}
              catatan absensi
            </p>
            <p className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <Camera size={13} />
              Klik thumbnail untuk memperbesar foto
              <ArrowUpRight size={13} />
            </p>
          </div>
        </section>

        <footer className="flex flex-col items-center justify-between gap-2 px-1 py-5 text-[11px] text-slate-400 sm:flex-row">
          <p>Riwayat Absensi · MGB ERP</p>
          <p>Data ditampilkan berdasarkan filter yang dipilih.</p>
        </footer>
      </div>

      {/* PHOTO MODAL */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#101D18]/80 p-3 backdrop-blur-md sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePhoto();
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={selectedPhoto.title}
            className="relative flex max-h-[95dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-white shadow-2xl shadow-black/30 dark:border-slate-700 dark:bg-slate-900"
          >
            {/* MODAL HEADER */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E7EFEB] px-4 py-4 sm:px-6 dark:border-slate-700">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#18352D] text-white">
                  <Camera size={21} />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-[#18352D] dark:text-white">
                    {selectedPhoto.title}
                  </h3>
                  <p className="mt-1 truncate text-xs text-slate-400">
                    Bukti kehadiran · {selectedPhoto.employee}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closePhoto}
                aria-label="Tutup foto"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DDE9E4] bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/30"
              >
                <X size={20} />
              </button>
            </div>

            {/* IMAGE VIEWER */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#E9EFEB] p-3 sm:p-7 dark:bg-slate-950">
              <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(#497F70_0.7px,transparent_0.7px)] [background-size:18px_18px]" />

              {imageError ? (
                <div className="relative z-10 flex max-w-sm flex-col items-center rounded-2xl border border-[#DDE9E4] bg-white p-8 text-center shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <ImageIcon size={38} className="text-slate-400" />
                  <p className="mt-4 font-bold text-[#18352D] dark:text-white">
                    Foto tidak dapat ditampilkan
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    Periksa URL foto atau akses penyimpanannya.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setImageError(false);
                      imageRef.current?.setAttribute("src", selectedPhoto.src);
                    }}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#3E6E61]"
                  >
                    <RotateCcw size={15} />
                    Coba lagi
                  </button>
                </div>
              ) : (
                <img
                  ref={imageRef}
                  key={`${selectedPhoto.attendanceId}-${selectedPhoto.title}-${selectedPhoto.src}`}
                  src={selectedPhoto.src}
                  alt={`${selectedPhoto.title} - ${selectedPhoto.employee}`}
                  onError={() => setImageError(true)}
                  className="relative z-10 max-h-[58dvh] max-w-full rounded-xl object-contain shadow-2xl shadow-black/20 sm:max-h-[65dvh]"
                />
              )}

              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => movePhoto(-1)}
                    aria-label="Foto sebelumnya"
                    className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/95 text-[#18352D] shadow-lg transition hover:scale-105 hover:bg-[#EAF3EF] sm:left-5 sm:h-12 sm:w-12 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  >
                    <ChevronLeft size={23} />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePhoto(1)}
                    aria-label="Foto berikutnya"
                    className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/95 text-[#18352D] shadow-lg transition hover:scale-105 hover:bg-[#EAF3EF] sm:right-5 sm:h-12 sm:w-12 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  >
                    <ChevronRight size={23} />
                  </button>
                </>
              )}

              <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/50 bg-[#18352D]/85 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur">
                {selectedPhotoIndex >= 0 ? selectedPhotoIndex + 1 : 1} /{" "}
                {photos.length}
              </div>
            </div>

            {/* PHOTO DETAILS */}
            <div className="shrink-0 border-t border-[#E7EFEB] bg-white px-4 py-4 sm:px-6 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:gap-x-8">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Karyawan
                    </p>
                    <p className="mt-1 max-w-[180px] truncate text-sm font-bold text-[#18352D] dark:text-white">
                      {selectedPhoto.employee}
                    </p>
                    <p className="mt-0.5 max-w-[180px] truncate text-xs text-slate-400">
                      {selectedPhoto.department}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Tanggal & Waktu
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#18352D] dark:text-white">
                      {selectedPhoto.date}
                    </p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400">
                      <Clock3 size={12} />
                      {selectedPhoto.time}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      window.open(
                        selectedPhoto.src,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-3.5 py-2.5 text-xs font-bold text-[#35564C] transition hover:bg-[#F5F8F6] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <ZoomIn size={15} />
                    Buka Asli
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadPhoto()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#3E6E61]"
                  >
                    <Download size={15} />
                    Unduh Foto
                  </button>
                </div>
              </div>

              {photos.length > 1 && (
                <div className="mt-4 flex gap-2 overflow-x-auto border-t border-[#EDF2EF] pt-3 dark:border-slate-700">
                  {photos.map((photo, index) => {
                    const active =
                      photo.attendanceId === selectedPhoto.attendanceId &&
                      photo.title === selectedPhoto.title;

                    return (
                      <button
                        type="button"
                        key={`${photo.attendanceId}-${photo.title}`}
                        onClick={() => {
                          setImageError(false);
                          setSelectedPhoto(photo);
                        }}
                        aria-label={`Pilih ${photo.title}, ${photo.employee}`}
                        className={`relative shrink-0 overflow-hidden rounded-lg border-2 transition ${
                          active
                            ? "border-[#497F70] ring-2 ring-[#497F70]/15"
                            : "border-transparent opacity-65 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={photo.src}
                          alt={photo.title}
                          className="h-12 w-12 object-cover sm:h-14 sm:w-14"
                        />
                        {active && (
                          <span className="absolute inset-x-0 bottom-0 h-1 bg-[#497F70]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="mt-3 text-[10px] text-slate-400">
                Tip: gunakan tombol ← → untuk berpindah foto dan Esc untuk
                menutup modal.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
