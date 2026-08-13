"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Camera,
  CheckCircle2,
  Clock3,
  RefreshCw,
  UserRound,
  XCircle,
} from "lucide-react";

export default function AttendancePage() {
  const [employees, setEmployees] =
    useState<any[]>([]);

  const [employeeId, setEmployeeId] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [loadingEmployee, setLoadingEmployee] =
    useState(true);

  const [photo, setPhoto] =
    useState<File | null>(null);

  const [preview, setPreview] =
    useState("");

  const videoRef =
    useRef<HTMLVideoElement>(null);

  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  // ==========================================
  // INITIAL LOAD
  // ==========================================

  useEffect(() => {
    loadEmployee();
    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  // ==========================================
  // LOAD EMPLOYEE
  // ==========================================

  async function loadEmployee() {
    try {
      setLoadingEmployee(true);

      const res =
        await fetch("/api/employee", {
          cache: "no-store",
        });

      const json =
        await res.json();

      if (json.success) {
        setEmployees(
          json.data ?? []
        );
      } else {
        setEmployees([]);
      }
    } catch (err) {
      console.error(
        "LOAD EMPLOYEE ERROR:",
        err
      );

      setEmployees([]);
    } finally {
      setLoadingEmployee(false);
    }
  }

  // ==========================================
  // CAMERA
  // ==========================================

  async function startCamera() {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: {
              facingMode: "user",
              width: 720,
              height: 720,
            },
            audio: false,
          }
        );

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject =
          stream;
      }
    } catch (err) {
      console.error(
        "CAMERA ERROR:",
        err
      );

      alert(
        "Kamera tidak tersedia"
      );
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      streamRef.current = null;
    }
  }

  // ==========================================
  // TAKE PHOTO
  // ==========================================

  function takePhoto() {
    const video =
      videoRef.current;

    const canvas =
      canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    if (
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      alert(
        "Kamera belum siap. Tunggu beberapa saat."
      );

      return;
    }

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;

    const ctx =
      canvas.getContext("2d");

    ctx?.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const file =
          new File(
            [blob],
            `attendance-${Date.now()}.jpg`,
            {
              type: "image/jpeg",
            }
          );

        setPhoto(file);

        setPreview(
          URL.createObjectURL(blob)
        );
      },
      "image/jpeg",
      0.9
    );
  }

  // ==========================================
  // UPLOAD PHOTO
  // ==========================================

  async function uploadPhoto() {
    if (!photo) {
      throw new Error(
        "Foto belum ada"
      );
    }

    const form =
      new FormData();

    form.append(
      "file",
      photo
    );

    const res =
      await fetch(
        "/api/upload/attendance",
        {
          method: "POST",
          body: form,
        }
      );

    const json =
      await res.json();

    if (!json.success) {
      throw new Error(
        json.message ||
          "Upload gagal"
      );
    }

    const url =
      json.photo ||
      json.url;

    if (!url) {
      throw new Error(
        "URL foto kosong"
      );
    }

    return url;
  }

  // ==========================================
  // ABSEN
  // ==========================================

  async function absen(
    type: "IN" | "OUT"
  ) {
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

      const photoUrl =
        await uploadPhoto();

      const res =
        await fetch(
          "/api/attendance",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              employeeId:
                Number(employeeId),

              type,

              photo: photoUrl,

              note: "",
            }),
          }
        );

      const json =
        await res.json();

      alert(
        json.message ||
          "Absensi selesai"
      );

      if (json.success) {
        setEmployeeId("");
        setPhoto(null);
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

  // ==========================================
  // SELECTED EMPLOYEE
  // ==========================================

  const selectedEmployee =
    employees.find(
      (e) =>
        String(e.id) ===
        employeeId
    );

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* ======================================
          HEADER
      ====================================== */}

      <div
        className="
          mb-7
          flex
          flex-col
          gap-4
          md:flex-row
          md:items-center
          md:justify-between
        "
      >
        <div className="flex items-center gap-3">

          <div
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-xl
              bg-[#497F70]
              text-white
              shadow-sm
            "
          >
            <Clock3 size={23} />
          </div>

          <div>
            <h1
              className="
                text-2xl
                font-bold
                tracking-tight
                text-[#18352D]
                md:text-3xl
              "
            >
              Absensi Pegawai
            </h1>

            <p
              className="
                mt-1
                text-sm
                text-gray-500
              "
            >
              Pencatatan kehadiran pegawai
              dengan foto selfie
            </p>
          </div>

        </div>

        <div
          className="
            inline-flex
            items-center
            gap-2
            self-start
            rounded-xl
            border
            border-[#D5E5DC]
            bg-white
            px-4
            py-2.5
            text-sm
            font-medium
            text-[#497F70]
            shadow-sm
            md:self-auto
          "
        >
          <Camera size={17} />

          Selfie Attendance
        </div>
      </div>


      {/* ======================================
          CONTENT
      ====================================== */}

      <div
        className="
          grid
          grid-cols-1
          gap-6
          lg:grid-cols-[minmax(0,1fr)_380px]
        "
      >

        {/* ====================================
            CAMERA CARD
        ==================================== */}

        <div
          className="
            overflow-hidden
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            shadow-sm
          "
        >

          {/* CARD HEADER */}

          <div
            className="
              border-b
              border-[#E5ECE9]
              px-5
              py-4
            "
          >
            <div className="flex items-center gap-3">

              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-[#EAF3EF]
                  text-[#497F70]
                "
              >
                <Camera size={19} />
              </div>

              <div>
                <h2
                  className="
                    font-semibold
                    text-[#18352D]
                  "
                >
                  Kamera Selfie
                </h2>

                <p
                  className="
                    mt-0.5
                    text-xs
                    text-gray-400
                  "
                >
                  Pastikan wajah terlihat
                  jelas sebelum mengambil foto
                </p>
              </div>

            </div>
          </div>


          {/* CAMERA */}

          <div className="p-5">

            <div
              className="
                relative
                overflow-hidden
                rounded-2xl
                border
                border-[#D5E5DC]
                bg-black
              "
            >

              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="
                  aspect-square
                  w-full
                  object-cover
                  md:aspect-video
                "
              />

              {/* CAMERA FRAME */}

              <div
                className="
                  pointer-events-none
                  absolute
                  inset-0
                  flex
                  items-center
                  justify-center
                "
              >
                <div
                  className="
                    h-[65%]
                    w-[48%]
                    rounded-[45%]
                    border-2
                    border-white/70
                    shadow-[0_0_0_9999px_rgba(0,0,0,0.12)]
                  "
                />
              </div>

            </div>

            <canvas
              ref={canvasRef}
              className="hidden"
            />


            {/* TAKE PHOTO */}

            <button
              type="button"
              onClick={takePhoto}
              disabled={loading}
              className="
                mt-4
                inline-flex
                w-full
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-[#497F70]
                px-5
                py-3
                text-sm
                font-semibold
                text-white
                shadow-sm
                transition
                hover:bg-[#3E6E61]
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              <Camera size={18} />

              Ambil Selfie
            </button>


            {/* PREVIEW */}

            {preview && (
              <div
                className="
                  mt-5
                  rounded-2xl
                  border
                  border-[#DDE9E4]
                  bg-[#F6F8F7]
                  p-4
                "
              >

                <div
                  className="
                    mb-3
                    flex
                    items-center
                    justify-between
                  "
                >
                  <div>
                    <p
                      className="
                        text-sm
                        font-semibold
                        text-[#18352D]
                      "
                    >
                      Foto Selfie
                    </p>

                    <p
                      className="
                        text-xs
                        text-gray-400
                      "
                    >
                      Foto siap digunakan
                    </p>
                  </div>

                  <CheckCircle2
                    size={19}
                    className="text-green-600"
                  />
                </div>

                <img
                  src={preview}
                  alt="Preview selfie"
                  className="
                    max-h-[420px]
                    w-full
                    rounded-xl
                    object-cover
                  "
                />

              </div>
            )}

          </div>
        </div>


        {/* ====================================
            FORM ABSENSI
        ==================================== */}

        <div className="space-y-6">

          {/* PEGAWAI */}

          <div
            className="
              rounded-2xl
              border
              border-[#DDE9E4]
              bg-white
              p-5
              shadow-sm
            "
          >

            <div
              className="
                mb-4
                flex
                items-center
                gap-3
              "
            >

              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-[#EAF3EF]
                  text-[#497F70]
                "
              >
                <UserRound size={19} />
              </div>

              <div>
                <h2
                  className="
                    font-semibold
                    text-[#18352D]
                  "
                >
                  Pilih Pegawai
                </h2>

                <p
                  className="
                    mt-0.5
                    text-xs
                    text-gray-400
                  "
                >
                  Pilih pegawai yang akan
                  melakukan absensi
                </p>
              </div>

            </div>


            <label
              className="
                mb-2
                block
                text-sm
                font-medium
                text-gray-700
              "
            >
              Pegawai
            </label>

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
                rounded-xl
                border
                border-[#D5E5DC]
                bg-[#FAFCFB]
                px-4
                py-3
                text-sm
                text-gray-700
                outline-none
                transition
                focus:border-[#497F70]
                focus:bg-white
                focus:ring-2
                focus:ring-[#497F70]/10
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >

              <option value="">
                {loadingEmployee
                  ? "Memuat pegawai..."
                  : "-- Pilih Pegawai --"}
              </option>

              {employees.map(
                (e) => (
                  <option
                    key={e.id}
                    value={e.id}
                  >
                    {e.nik} - {e.name}
                  </option>
                )
              )}

            </select>


            {/* SELECTED EMPLOYEE */}

            {selectedEmployee && (
              <div
                className="
                  mt-4
                  rounded-xl
                  bg-[#EAF3EF]
                  p-4
                "
              >

                <p
                  className="
                    text-xs
                    font-medium
                    uppercase
                    tracking-wide
                    text-[#497F70]
                  "
                >
                  Pegawai Terpilih
                </p>

                <p
                  className="
                    mt-1
                    font-semibold
                    text-[#18352D]
                  "
                >
                  {selectedEmployee.name}
                </p>

                <div
                  className="
                    mt-1
                    text-xs
                    text-gray-500
                  "
                >
                  NIK:{" "}
                  {selectedEmployee.nik ||
                    "-"}
                </div>

                {selectedEmployee.position && (
                  <div
                    className="
                      mt-0.5
                      text-xs
                      text-gray-500
                    "
                  >
                    Jabatan:{" "}
                    {selectedEmployee.position}
                  </div>
                )}

              </div>
            )}

          </div>


          {/* ACTION CARD */}

          <div
            className="
              rounded-2xl
              border
              border-[#DDE9E4]
              bg-white
              p-5
              shadow-sm
            "
          >

            <div
              className="
                mb-4
                flex
                items-center
                gap-3
              "
            >

              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-[#EAF3EF]
                  text-[#497F70]
                "
              >
                <Clock3 size={19} />
              </div>

              <div>
                <h2
                  className="
                    font-semibold
                    text-[#18352D]
                  "
                >
                  Catat Kehadiran
                </h2>

                <p
                  className="
                    mt-0.5
                    text-xs
                    text-gray-400
                  "
                >
                  Pilih jenis absensi
                </p>
              </div>

            </div>


            {/* CHECK IN */}

            <button
              type="button"
              disabled={
                loading ||
                !employeeId ||
                !photo
              }
              onClick={() =>
                absen("IN")
              }
              className="
                flex
                w-full
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-green-600
                px-5
                py-3.5
                text-sm
                font-semibold
                text-white
                shadow-sm
                transition
                hover:bg-green-700
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >

              {loading ? (
                <RefreshCw
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <CheckCircle2
                  size={18}
                />
              )}

              Check In
            </button>


            {/* CHECK OUT */}

            <button
              type="button"
              disabled={
                loading ||
                !employeeId ||
                !photo
              }
              onClick={() =>
                absen("OUT")
              }
              className="
                mt-3
                flex
                w-full
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-red-600
                px-5
                py-3.5
                text-sm
                font-semibold
                text-white
                shadow-sm
                transition
                hover:bg-red-700
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >

              {loading ? (
                <RefreshCw
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <XCircle
                  size={18}
                />
              )}

              Check Out
            </button>


            {/* INFO */}

            <div
              className="
                mt-4
                rounded-xl
                border
                border-[#E5ECE9]
                bg-[#F6F8F7]
                p-3
                text-xs
                leading-5
                text-gray-500
              "
            >
              <strong className="text-[#35564C]">
                Catatan:
              </strong>{" "}
              Pegawai harus memilih nama dan
              mengambil foto selfie sebelum
              melakukan Check In atau Check Out.
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}