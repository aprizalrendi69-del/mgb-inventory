"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  Fingerprint,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";

type Employee = {
  id: number;
  nik?: string | null;
  name?: string | null;
  position?: string | null;
  [key: string]: any;
};

type AttendanceType = "IN" | "OUT";

export default function AttendancePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingEmployee, setLoadingEmployee] = useState(true);

  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const [lastAction, setLastAction] =
    useState<AttendanceType | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // =========================================================
  // LOAD EMPLOYEE
  // =========================================================

  const loadEmployee = useCallback(async () => {
    try {
      setLoadingEmployee(true);

      const res = await fetch("/api/employee", {
        cache: "no-store",
      });

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

  // =========================================================
  // STOP CAMERA
  // =========================================================

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    }

    setCameraReady(false);
  }, []);

  // =========================================================
  // START CAMERA
  // =========================================================

  const startCamera = useCallback(async () => {
    try {
      setCameraError("");
      setCameraReady(false);

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          "Browser tidak mendukung akses kamera."
        );
        return;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });

        streamRef.current = null;
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: {
              ideal: 720,
            },
            height: {
              ideal: 720,
            },
          },
          audio: false,
        });

      streamRef.current = stream;

      const video = videoRef.current;

      if (!video) {
        return;
      }

      video.srcObject = stream;

      video.onloadedmetadata = async () => {
        try {
          await video.play();
        } catch (error) {
          console.error(
            "VIDEO PLAY ERROR:",
            error
          );
        }

        setCameraReady(true);
      };
    } catch (err) {
      console.error("CAMERA ERROR:", err);

      setCameraReady(false);

      setCameraError(
        "Kamera tidak dapat diakses. Pastikan izin kamera telah diberikan."
      );
    }
  }, []);

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadEmployee();
    startCamera();

    return () => {
      stopCamera();
    };
  }, [
    loadEmployee,
    startCamera,
    stopCamera,
  ]);

  // =========================================================
  // CLEAN PREVIEW URL
  // =========================================================

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  // =========================================================
  // TAKE PHOTO
  // =========================================================

  function takePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    if (
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      setCameraError(
        "Kamera belum siap. Tunggu beberapa saat."
      );
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          return;
        }

        if (preview) {
          URL.revokeObjectURL(preview);
        }

        const file = new File(
          [blob],
          `attendance-${Date.now()}.jpg`,
          {
            type: "image/jpeg",
          }
        );

        const objectUrl =
          URL.createObjectURL(blob);

        setPhoto(file);
        setPreview(objectUrl);
        setCameraError("");
      },
      "image/jpeg",
      0.9
    );
  }

  // =========================================================
  // UPLOAD PHOTO
  // =========================================================

  async function uploadPhoto() {
    if (!photo) {
      throw new Error("Foto belum ada");
    }

    const form = new FormData();

    form.append("file", photo);

    const res = await fetch(
      "/api/upload/attendance",
      {
        method: "POST",
        body: form,
      }
    );

    const json = await res.json();

    if (!json.success) {
      throw new Error(
        json.message || "Upload gagal"
      );
    }

    const url = json.photo || json.url;

    if (!url) {
      throw new Error("URL foto kosong");
    }

    return url;
  }

  // =========================================================
  // ABSEN
  // =========================================================

  async function absen(type: AttendanceType) {
    if (!employeeId) {
      alert(
        "Pilih pegawai terlebih dahulu"
      );
      return;
    }

    if (!photo) {
      alert(
        "Ambil foto selfie terlebih dahulu"
      );
      return;
    }

    try {
      setLoading(true);
      setLastAction(null);

      const photoUrl =
        await uploadPhoto();

      const res = await fetch(
        "/api/attendance",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            employeeId: Number(employeeId),
            type,
            photo: photoUrl,
            note: "",
          }),
        }
      );

      const json = await res.json();

      alert(
        json.message ||
          "Absensi selesai"
      );

      if (json.success) {
        setLastAction(type);
        setEmployeeId("");
        setPhoto(null);

        if (preview) {
          URL.revokeObjectURL(preview);
        }

        setPreview("");
      }
    } catch (err: any) {
      console.error(
        "ABSENSI ERROR:",
        err
      );

      alert(
        err.message ||
          "Absensi gagal"
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // SELECTED EMPLOYEE
  // =========================================================

  const selectedEmployee =
    useMemo(() => {
      return employees.find(
        (employee) =>
          String(employee.id) ===
          employeeId
      );
    }, [
      employees,
      employeeId,
    ]);

  // =========================================================
  // INITIALS
  // =========================================================

  function getInitials(
    name?: string | null
  ) {
    if (!name) {
      return "PG";
    }

    const parts = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 1) {
      return parts[0]
        .slice(0, 2)
        .toUpperCase();
    }

    return `${parts[0][0]}${parts[1][0]}`
      .toUpperCase();
  }

  // =========================================================
  // READINESS
  // =========================================================

  const readyEmployee =
    Boolean(employeeId);

  const readyPhoto =
    Boolean(
      photo &&
        preview
    );

  const readyToAttend =
    readyEmployee &&
    readyPhoto &&
    !loading;

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="min-h-full bg-[#F5F8F6]">
      <div className="mx-auto max-w-[1500px] p-5 md:p-7 xl:p-9">

        {/* ===================================================
            PREMIUM HEADER
        =================================================== */}

        <div className="relative mb-7 overflow-hidden rounded-[30px] border border-[#DCE9E3] bg-white shadow-[0_18px_60px_rgba(24,53,45,0.07)]">

          <div className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-[#497F70]/10 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-emerald-100/30 blur-3xl" />

          <div
            className="
              absolute
              inset-0
              opacity-[0.025]
              [background-image:linear-gradient(#18352D_1px,transparent_1px),linear-gradient(90deg,#18352D_1px,transparent_1px)]
              [background-size:32px_32px]
            "
          />

          <div className="relative flex flex-col gap-6 p-6 md:p-8 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-start gap-4">

              <div className="relative shrink-0">

                <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#18352D] text-white shadow-[0_12px_28px_rgba(24,53,45,0.2)]">
                  <Fingerprint
                    size={27}
                    strokeWidth={1.8}
                  />
                </div>

                <div className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500">
                  <Check
                    size={11}
                    strokeWidth={3}
                    className="text-white"
                  />
                </div>

              </div>

              <div>

                <div className="mb-1 flex flex-wrap items-center gap-2">

                  <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#497F70]">
                    MGB Human Resources
                  </span>

                  <span className="h-1 w-1 rounded-full bg-slate-300" />

                  <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Attendance Terminal
                  </span>

                </div>

                <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-[30px]">
                  Absensi Pegawai
                </h1>

                <p className="mt-1.5 max-w-xl text-xs leading-5 text-slate-400 md:text-sm">
                  Pencatatan kehadiran pegawai
                  dengan verifikasi identitas
                  melalui foto selfie.
                </p>

              </div>

            </div>

            {/* SYSTEM STATUS */}

            <div className="flex flex-wrap items-center gap-2">

              <div className="flex items-center gap-2 rounded-2xl border border-[#DDEAE4] bg-[#F8FBF9] px-3.5 py-2.5">

                <span
                  className={`relative flex h-2.5 w-2.5 ${
                    cameraReady
                      ? ""
                      : "opacity-40"
                  }`}
                >

                  {cameraReady ? (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  ) : null}

                  <span
                    className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                      cameraReady
                        ? "bg-emerald-500"
                        : "bg-slate-400"
                    }`}
                  />

                </span>

                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  {cameraReady
                    ? "Camera Ready"
                    : "Camera Offline"}
                </span>

              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-[#DDEAE4] bg-white px-3.5 py-2.5">

                <ShieldCheck
                  size={15}
                  className="text-[#497F70]"
                />

                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Secure Attendance
                </span>

              </div>

            </div>

          </div>
        </div>

        {/* ===================================================
            MAIN GRID
        =================================================== */}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_410px]">

          {/* =================================================
              CAMERA CONSOLE
          ================================================= */}

          <section className="overflow-hidden rounded-[30px] border border-[#DCE9E3] bg-white shadow-[0_18px_60px_rgba(24,53,45,0.055)]">

            <div className="flex flex-col gap-4 border-b border-[#E9EFEC] px-6 py-5 md:flex-row md:items-center md:justify-between md:px-7">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-[#EAF3EF] text-[#497F70]">
                  <Camera
                    size={20}
                    strokeWidth={1.8}
                  />
                </div>

                <div>

                  <div className="text-[8px] font-bold uppercase tracking-[0.22em] text-[#497F70]">
                    Capture Station
                  </div>

                  <h2 className="mt-0.5 text-base font-bold tracking-tight text-[#18352D]">
                    Kamera Selfie
                  </h2>

                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Posisikan wajah di dalam
                    area panduan.
                  </p>

                </div>

              </div>

              <div
                className={`inline-flex items-center gap-2 self-start rounded-xl px-3 py-2 text-[9px] font-bold uppercase tracking-[0.15em] md:self-auto ${
                  cameraReady
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >

                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    cameraReady
                      ? "bg-emerald-500"
                      : "bg-slate-400"
                  }`}
                />

                {cameraReady
                  ? "Live Camera"
                  : "Waiting"}

              </div>

            </div>

            <div className="p-5 md:p-7">

              <div className="relative overflow-hidden rounded-[27px] border border-[#D7E5DF] bg-[#101816] shadow-[0_20px_50px_rgba(15,23,42,0.14)]">

                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="aspect-square w-full object-cover md:aspect-[16/10]"
                />

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30" />

                {/* TOP STATUS */}

                <div className="absolute left-4 right-4 top-4 flex items-center justify-between">

                  <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-1.5 backdrop-blur-md">

                    <span className="relative flex h-2 w-2">

                      {cameraReady ? (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                      ) : null}

                      <span
                        className={`relative h-2 w-2 rounded-full ${
                          cameraReady
                            ? "bg-emerald-400"
                            : "bg-white/40"
                        }`}
                      />

                    </span>

                    <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/90">
                      {cameraReady
                        ? "Live"
                        : "Offline"}
                    </span>

                  </div>

                  <div className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/80 backdrop-blur-md">
                    Selfie Verification
                  </div>

                </div>

                {/* FACE GUIDE */}

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">

                  <div className="relative h-[58%] w-[35%] min-w-[150px] max-w-[250px] rounded-[48%] border border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.16)]">

                    <div className="absolute -left-1 -top-1 h-7 w-7 rounded-tl-[18px] border-l-2 border-t-2 border-white" />

                    <div className="absolute -right-1 -top-1 h-7 w-7 rounded-tr-[18px] border-r-2 border-t-2 border-white" />

                    <div className="absolute -bottom-1 -left-1 h-7 w-7 rounded-bl-[18px] border-b-2 border-l-2 border-white" />

                    <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-br-[18px] border-b-2 border-r-2 border-white" />

                  </div>

                </div>

                {/* CAMERA ERROR */}

                {cameraError ? (
                  <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-red-200/20 bg-red-950/65 px-4 py-3 text-xs font-medium text-white backdrop-blur-md">
                    {cameraError}
                  </div>
                ) : null}

                {/* CAMERA READY */}

                {cameraReady &&
                !cameraError ? (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-black/30 px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/90 backdrop-blur-md">
                    Pastikan wajah terlihat jelas
                  </div>
                ) : null}

              </div>

              <canvas
                ref={canvasRef}
                className="hidden"
              />

              {/* CAMERA CONTROLS */}

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">

                <button
                  type="button"
                  onClick={takePhoto}
                  disabled={
                    loading ||
                    !cameraReady
                  }
                  className="
                    group
                    inline-flex
                    min-h-[54px]
                    items-center
                    justify-center
                    gap-2.5
                    rounded-2xl
                    bg-[#497F70]
                    px-5
                    text-sm
                    font-bold
                    text-white
                    shadow-[0_12px_25px_rgba(73,127,112,0.2)]
                    transition-all
                    duration-300
                    hover:-translate-y-0.5
                    hover:bg-[#3F6F62]
                    hover:shadow-[0_16px_32px_rgba(73,127,112,0.26)]
                    disabled:cursor-not-allowed
                    disabled:opacity-45
                  "
                >

                  <Camera
                    size={19}
                    className="transition-transform duration-300 group-hover:scale-110"
                  />

                  Ambil Selfie

                </button>

                <button
                  type="button"
                  onClick={startCamera}
                  disabled={loading}
                  className="
                    inline-flex
                    min-h-[54px]
                    items-center
                    justify-center
                    gap-2
                    rounded-2xl
                    border
                    border-[#D9E6E0]
                    bg-[#F8FBF9]
                    px-5
                    text-xs
                    font-bold
                    text-[#497F70]
                    transition-all
                    hover:border-[#BFD5CB]
                    hover:bg-[#EFF7F3]
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >

                  <RefreshCw
                    size={16}
                  />

                  Restart

                </button>

              </div>

              {/* PREVIEW */}

              {preview ? (
                <div className="mt-6 overflow-hidden rounded-[25px] border border-[#DDE9E4] bg-[#F7FAF8]">

                  <div className="flex items-center justify-between border-b border-[#E5ECE9] px-5 py-4">

                    <div className="flex items-center gap-3">

                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <CheckCircle2
                          size={18}
                        />
                      </div>

                      <div>

                        <p className="text-xs font-bold text-[#18352D]">
                          Foto Siap
                        </p>

                        <p className="mt-0.5 text-[10px] text-slate-400">
                          Selfie berhasil
                          diambil dan siap
                          diverifikasi.
                        </p>

                      </div>

                    </div>

                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.15em] text-emerald-700">
                      Verified Capture
                    </span>

                  </div>

                  <div className="p-4 md:p-5">

                    <div className="relative overflow-hidden rounded-[20px] bg-slate-900">

                      <img
                        src={preview}
                        alt="Preview selfie"
                        className="max-h-[440px] w-full object-cover"
                      />

                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />

                    </div>

                  </div>

                </div>
              ) : (
                <div className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-[#D5E4DD] bg-[#FAFCFB] px-4 py-4">

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                    <Camera
                      size={17}
                    />
                  </div>

                  <div>

                    <p className="text-[11px] font-bold text-slate-600">
                      Belum ada foto selfie
                    </p>

                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Ambil foto untuk
                      mengaktifkan tombol
                      absensi.
                    </p>

                  </div>

                </div>
              )}

            </div>
          </section>

          {/* =================================================
              RIGHT PANEL
          ================================================= */}

          <aside className="space-y-6">

            {/* EMPLOYEE */}

            <section className="rounded-[30px] border border-[#DCE9E3] bg-white p-6 shadow-[0_18px_60px_rgba(24,53,45,0.055)]">

              <div className="mb-5 flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-[#EAF3EF] text-[#497F70]">
                  <UserRound
                    size={20}
                    strokeWidth={1.8}
                  />
                </div>

                <div>

                  <div className="text-[8px] font-bold uppercase tracking-[0.22em] text-[#497F70]">
                    Identity
                  </div>

                  <h2 className="mt-0.5 text-base font-bold tracking-tight text-[#18352D]">
                    Pilih Pegawai
                  </h2>

                  <p className="mt-0.5 text-[10px] text-slate-400">
                    Tentukan identitas
                    kehadiran.
                  </p>

                </div>

              </div>

              <label className="mb-2.5 block text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">
                Pegawai
              </label>

              <div className="relative">

                <select
                  value={employeeId}
                  onChange={(e) =>
                    setEmployeeId(
                      e.target.value
                    )
                  }
                  disabled={
                    loadingEmployee ||
                    loading
                  }
                  className="
                    w-full
                    appearance-none
                    rounded-2xl
                    border
                    border-[#D7E5DF]
                    bg-[#F9FBFA]
                    px-4
                    py-3.5
                    pr-10
                    text-xs
                    font-semibold
                    text-slate-700
                    outline-none
                    transition
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-4
                    focus:ring-[#497F70]/8
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
                >

                  <option value="">
                    {loadingEmployee
                      ? "Memuat data pegawai..."
                      : "-- Pilih Pegawai --"}
                  </option>

                  {employees.map(
                    (employee) => (
                      <option
                        key={employee.id}
                        value={employee.id}
                      >
                        {employee.nik
                          ? `${employee.nik} - `
                          : ""}
                        {employee.name ||
                          "Tanpa Nama"}
                      </option>
                    )
                  )}

                </select>

                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">

                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>

                </div>

              </div>

              {/* SELECTED EMPLOYEE */}

              {selectedEmployee ? (
                <div className="mt-5 overflow-hidden rounded-[23px] border border-[#D9E8E1] bg-gradient-to-br from-[#EFF7F3] to-[#F8FBF9]">

                  <div className="p-4">

                    <div className="flex items-center gap-3">

                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#18352D] text-sm font-bold text-white shadow-sm">
                        {getInitials(
                          selectedEmployee.name
                        )}
                      </div>

                      <div className="min-w-0 flex-1">

                        <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#497F70]">
                          Pegawai Terpilih
                        </div>

                        <p className="mt-1 truncate text-sm font-bold text-[#18352D]">
                          {selectedEmployee.name ||
                            "Tanpa Nama"}
                        </p>

                      </div>

                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <Check
                          size={14}
                          strokeWidth={3}
                        />
                      </div>

                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">

                      <div className="rounded-xl bg-white/70 px-3 py-2.5">

                        <div className="text-[7px] font-bold uppercase tracking-[0.16em] text-slate-400">
                          NIK
                        </div>

                        <div className="mt-1 truncate text-[10px] font-bold text-slate-600">
                          {selectedEmployee.nik ||
                            "-"}
                        </div>

                      </div>

                      <div className="rounded-xl bg-white/70 px-3 py-2.5">

                        <div className="text-[7px] font-bold uppercase tracking-[0.16em] text-slate-400">
                          Jabatan
                        </div>

                        <div className="mt-1 truncate text-[10px] font-bold text-slate-600">
                          {selectedEmployee.position ||
                            "-"}
                        </div>

                      </div>

                    </div>

                  </div>

                </div>
              ) : (
                <div className="mt-5 flex items-center gap-3 rounded-2xl border border-dashed border-[#D9E5DF] bg-[#FAFCFB] px-4 py-4">

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                    <UsersRound
                      size={16}
                    />
                  </div>

                  <div>

                    <p className="text-[10px] font-bold text-slate-600">
                      Belum ada pegawai
                    </p>

                    <p className="mt-0.5 text-[9px] text-slate-400">
                      Pilih pegawai untuk
                      melanjutkan.
                    </p>

                  </div>

                </div>
              )}

            </section>

            {/* ATTENDANCE ACTION */}

            <section className="overflow-hidden rounded-[30px] border border-[#DCE9E3] bg-white shadow-[0_18px_60px_rgba(24,53,45,0.055)]">

              <div className="border-b border-[#E9EFEC] px-6 py-5">

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-[#EAF3EF] text-[#497F70]">
                    <Clock3
                      size={20}
                      strokeWidth={1.8}
                    />
                  </div>

                  <div>

                    <div className="text-[8px] font-bold uppercase tracking-[0.22em] text-[#497F70]">
                      Attendance Action
                    </div>

                    <h2 className="mt-0.5 text-base font-bold tracking-tight text-[#18352D]">
                      Catat Kehadiran
                    </h2>

                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Pilih tindakan absensi.
                    </p>

                  </div>

                </div>

              </div>

              <div className="p-6">

                {/* READINESS */}

                <div className="mb-5 rounded-[21px] border border-[#E2ECE7] bg-[#F8FAF9] p-4">

                  <div className="mb-3 flex items-center justify-between">

                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Readiness
                    </span>

                    <span
                      className={`text-[9px] font-bold ${
                        readyToAttend
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }`}
                    >
                      {readyToAttend
                        ? "READY"
                        : "INCOMPLETE"}
                    </span>

                  </div>

                  <div className="space-y-2">

                    <ReadinessRow
                      label="Pegawai"
                      ready={readyEmployee}
                    />

                    <ReadinessRow
                      label="Foto selfie"
                      ready={readyPhoto}
                    />

                  </div>

                </div>

                {/* CHECK IN */}

                <button
                  type="button"
                  disabled={!readyToAttend}
                  onClick={() =>
                    absen("IN")
                  }
                  className="
                    group
                    flex
                    min-h-[58px]
                    w-full
                    items-center
                    justify-between
                    rounded-[19px]
                    bg-[#18352D]
                    px-5
                    text-white
                    shadow-[0_14px_30px_rgba(24,53,45,0.18)]
                    transition-all
                    duration-300
                    hover:-translate-y-0.5
                    hover:bg-[#21473C]
                    hover:shadow-[0_18px_35px_rgba(24,53,45,0.24)]
                    disabled:cursor-not-allowed
                    disabled:opacity-35
                    disabled:hover:translate-y-0
                  "
                >

                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">

                      {loading ? (
                        <Loader2
                          size={17}
                          className="animate-spin"
                        />
                      ) : (
                        <CheckCircle2
                          size={18}
                        />
                      )}

                    </div>

                    <div className="text-left">

                      <div className="text-[11px] font-bold">
                        Check In
                      </div>

                      <div className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.13em] text-white/45">
                        Mulai Kehadiran
                      </div>

                    </div>

                  </div>

                  <div className="text-white/40 transition-transform group-hover:translate-x-1">
                    →
                  </div>

                </button>

                {/* CHECK OUT */}

                <button
                  type="button"
                  disabled={!readyToAttend}
                  onClick={() =>
                    absen("OUT")
                  }
                  className="
                    group
                    mt-3
                    flex
                    min-h-[58px]
                    w-full
                    items-center
                    justify-between
                    rounded-[19px]
                    border
                    border-[#E8D9D9]
                    bg-[#FFF9F9]
                    px-5
                    text-red-600
                    transition-all
                    duration-300
                    hover:-translate-y-0.5
                    hover:border-red-200
                    hover:bg-red-50
                    disabled:cursor-not-allowed
                    disabled:opacity-35
                    disabled:hover:translate-y-0
                  "
                >

                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">

                      {loading ? (
                        <Loader2
                          size={17}
                          className="animate-spin"
                        />
                      ) : (
                        <XCircle
                          size={18}
                        />
                      )}

                    </div>

                    <div className="text-left">

                      <div className="text-[11px] font-bold">
                        Check Out
                      </div>

                      <div className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.13em] text-red-400">
                        Akhiri Kehadiran
                      </div>

                    </div>

                  </div>

                  <div className="text-red-300 transition-transform group-hover:translate-x-1">
                    →
                  </div>

                </button>

                {/* LAST ACTION */}

                {lastAction ? (
                  <div className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-[10px] font-semibold text-emerald-700">

                    <CheckCircle2
                      size={15}
                    />

                    <span>
                      Absensi berhasil
                      dicatat sebagai{" "}
                      <strong>
                        {lastAction === "IN"
                          ? "Check In"
                          : "Check Out"}
                      </strong>
                      .
                    </span>

                  </div>
                ) : null}

                {/* INFO */}

                <div className="mt-5 flex gap-3 rounded-[19px] border border-[#E5ECE9] bg-[#F8FAF9] p-4">

                  <div className="mt-0.5 shrink-0 text-[#497F70]">

                    <ShieldCheck
                      size={16}
                    />

                  </div>

                  <div>

                    <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#35564C]">
                      Attendance Policy
                    </p>

                    <p className="mt-1 text-[10px] leading-5 text-slate-400">
                      Pegawai harus memilih
                      identitas dan mengambil
                      foto selfie sebelum
                      melakukan Check In atau
                      Check Out.
                    </p>

                  </div>

                </div>

              </div>
            </section>

          </aside>
        </div>

        {/* ===================================================
            FOOTER STATUS
        =================================================== */}

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">

          <StatusCard
            icon={
              <Camera size={17} />
            }
            label="Camera"
            value={
              cameraReady
                ? "Operational"
                : "Unavailable"
            }
            ready={cameraReady}
          />

          <StatusCard
            icon={
              <UserRound size={17} />
            }
            label="Employee"
            value={
              loadingEmployee
                ? "Loading..."
                : `${employees.length} Pegawai`
            }
            ready={
              !loadingEmployee &&
              employees.length > 0
            }
          />

          <StatusCard
            icon={
              <Sparkles size={17} />
            }
            label="Capture"
            value={
              readyPhoto
                ? "Photo Ready"
                : "Waiting Photo"
            }
            ready={readyPhoto}
          />

        </div>

      </div>
    </div>
  );
}

// =============================================================
// READINESS ROW
// =============================================================

function ReadinessRow({
  label,
  ready,
}: {
  label: string;
  ready: boolean;
}) {
  return (
    <div className="flex items-center justify-between">

      <div className="flex items-center gap-2.5">

        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full ${
            ready
              ? "bg-emerald-100 text-emerald-600"
              : "bg-slate-200 text-slate-400"
          }`}
        >

          {ready ? (
            <Check
              size={11}
              strokeWidth={3}
            />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          )}

        </div>

        <span className="text-[10px] font-semibold text-slate-600">
          {label}
        </span>

      </div>

      <span
        className={`text-[8px] font-bold uppercase tracking-[0.13em] ${
          ready
            ? "text-emerald-600"
            : "text-slate-400"
        }`}
      >
        {ready
          ? "Ready"
          : "Required"}
      </span>

    </div>
  );
}

// =============================================================
// STATUS CARD
// =============================================================

function StatusCard({
  icon,
  label,
  value,
  ready,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-[#DCE9E3] bg-white px-4 py-3.5 shadow-[0_8px_28px_rgba(24,53,45,0.035)]">

      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          ready
            ? "bg-emerald-50 text-[#497F70]"
            : "bg-slate-100 text-slate-400"
        }`}
      >
        {icon}
      </div>

      <div className="min-w-0">

        <div className="text-[7px] font-bold uppercase tracking-[0.18em] text-slate-400">
          {label}
        </div>

        <div
          className={`mt-0.5 truncate text-[10px] font-bold ${
            ready
              ? "text-[#18352D]"
              : "text-slate-500"
          }`}
        >
          {value}
        </div>

      </div>

      <div className="ml-auto">

        <span
          className={`block h-2 w-2 rounded-full ${
            ready
              ? "bg-emerald-500"
              : "bg-slate-300"
          }`}
        />

      </div>

    </div>
  );
}