"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Camera,
  CheckCircle2,
  LogIn,
  LogOut,
  RefreshCw,
  UserRound,
  X,
} from "lucide-react";

type Employee = {
  id: number;
  nik: string;
  name: string;
  position?: string | null;
  department?: string | null;
};

export default function AbsensiPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");

  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loading, setLoading] = useState(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /*
  |--------------------------------------------------------------------------
  | LOAD EMPLOYEE
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    loadEmployees();
    startCamera();

    return () => {
      stopCamera();

      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, []);

  async function loadEmployees() {
    try {
      setLoadingEmployees(true);

      const res = await fetch("/api/employee", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setEmployees(json.data || []);
      } else {
        alert(json.message || "Gagal mengambil data karyawan");
      }
    } catch (error) {
      console.error("LOAD EMPLOYEE ERROR:", error);
      alert("Gagal mengambil data karyawan");
    } finally {
      setLoadingEmployees(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | CAMERA
  |--------------------------------------------------------------------------
  */

  async function startCamera() {
    try {
      setCameraError("");
      setCameraReady(false);

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraError(
          "Browser tidak mendukung akses kamera."
        );
        return;
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

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        await videoRef.current.play().catch(() => {});

        setCameraReady(true);
      }
    } catch (error) {
      console.error("CAMERA ERROR:", error);

      setCameraReady(false);

      setCameraError(
        "Kamera tidak dapat digunakan. Pastikan izin kamera sudah diberikan."
      );
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | TAKE SELFIE
  |--------------------------------------------------------------------------
  */

  function takePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      alert("Kamera belum siap");
      return;
    }

    if (
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      alert("Kamera belum siap. Tunggu beberapa detik.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      alert("Gagal mengambil gambar");
      return;
    }

    /*
     * Mirror selfie supaya hasil foto terlihat natural.
     */
    ctx.save();

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.restore();

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          alert("Gagal membuat foto");
          return;
        }

        const file = new File(
          [blob],
          `attendance-${Date.now()}.jpg`,
          {
            type: "image/jpeg",
          }
        );

        if (preview) {
          URL.revokeObjectURL(preview);
        }

        const previewUrl =
          URL.createObjectURL(blob);

        setPhoto(file);
        setPreview(previewUrl);
      },
      "image/jpeg",
      0.9
    );
  }

  /*
  |--------------------------------------------------------------------------
  | RESET PHOTO
  |--------------------------------------------------------------------------
  */

  function resetPhoto() {
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setPhoto(null);
    setPreview("");
  }

  /*
  |--------------------------------------------------------------------------
  | UPLOAD PHOTO
  |--------------------------------------------------------------------------
  */

  async function uploadPhoto() {
    if (!photo) {
      throw new Error("Foto selfie belum diambil");
    }

    const formData = new FormData();

    formData.append(
      "file",
      photo
    );

    const res = await fetch(
      "/api/upload/attendance",
      {
        method: "POST",
        body: formData,
      }
    );

    const json = await res.json();

    console.log(
      "UPLOAD ATTENDANCE:",
      json
    );

    if (!res.ok || !json.success) {
      throw new Error(
        json.message ||
          "Upload foto gagal"
      );
    }

    const photoUrl =
      json.photo ||
      json.url;

    if (!photoUrl) {
      throw new Error(
        "URL foto tidak ditemukan"
      );
    }

    return photoUrl;
  }

  /*
  |--------------------------------------------------------------------------
  | ABSEN
  |--------------------------------------------------------------------------
  */

  async function absen(
    type: "IN" | "OUT"
  ) {
    if (!employeeId) {
      alert("Pilih karyawan terlebih dahulu");
      return;
    }

    if (!photo) {
      alert("Ambil foto selfie terlebih dahulu");
      return;
    }

    try {
      setLoading(true);

      /*
       * Upload foto terlebih dahulu.
       */
      const photoUrl =
        await uploadPhoto();

      console.log(
        "FOTO ABSENSI:",
        photoUrl
      );

      /*
       * Kirim ke API attendance.
       */
      const res = await fetch(
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

            photo:
              photoUrl,

            note: "",
          }),
        }
      );

      const json =
        await res.json();

      console.log(
        "ATTENDANCE RESULT:",
        json
      );

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Absensi gagal"
        );
      }

      alert(
        json.message ||
          "Absensi berhasil"
      );

      /*
       * Reset form setelah berhasil.
       */
      setEmployeeId("");

      resetPhoto();

    } catch (error: any) {
      console.error(
        "ABSENSI ERROR:",
        error
      );

      alert(
        error.message ||
          "Absensi gagal"
      );
    } finally {
      setLoading(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | SELECTED EMPLOYEE
  |--------------------------------------------------------------------------
  */

  const selectedEmployee =
    employees.find(
      (employee) =>
        String(employee.id) ===
        employeeId
    );

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  return (
    <div className="min-h-screen bg-[#F5F7F6] p-4 md:p-6 lg:p-8">

      {/* HEADER */}
      <div className="mb-6">

        <div className="flex items-center gap-3">

          <div className="
            flex
            h-11
            w-11
            items-center
            justify-center
            rounded-xl
            bg-[#497F70]
            text-white
            shadow-sm
          ">
            <UserRound size={22} />
          </div>

          <div>
            <h1 className="
              text-2xl
              font-bold
              tracking-tight
              text-[#173C32]
            ">
              Absensi Karyawan
            </h1>

            <p className="
              mt-1
              text-sm
              text-gray-500
            ">
              Check In dan Check Out menggunakan
              foto selfie
            </p>
          </div>

        </div>

      </div>


      {/* MAIN GRID */}
      <div className="
        grid
        grid-cols-1
        gap-6
        lg:grid-cols-[minmax(0,1fr)_380px]
      ">

        {/* CAMERA */}
        <div className="
          overflow-hidden
          rounded-2xl
          border
          border-[#DCE8E2]
          bg-white
          shadow-sm
        ">

          <div className="
            flex
            items-center
            justify-between
            border-b
            border-[#E7EFEB]
            px-5
            py-4
          ">

            <div>

              <h2 className="
                font-semibold
                text-[#173C32]
              ">
                Kamera Selfie
              </h2>

              <p className="
                mt-1
                text-xs
                text-gray-500
              ">
                Pastikan wajah terlihat jelas
              </p>

            </div>

            <div className={`
              flex
              items-center
              gap-2
              rounded-full
              px-3
              py-1.5
              text-xs
              font-medium
              ${
                cameraReady
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-600"
              }
            `}>

              <span className={`
                h-2
                w-2
                rounded-full
                ${
                  cameraReady
                    ? "bg-green-500"
                    : "bg-red-500"
                }
              `} />

              {cameraReady
                ? "Kamera Aktif"
                : "Kamera Tidak Aktif"}

            </div>

          </div>


          {/* CAMERA AREA */}
          <div className="
            relative
            aspect-square
            w-full
            overflow-hidden
            bg-black
          ">

            {preview ? (
              <img
                src={preview}
                alt="Preview selfie"
                className="
                  h-full
                  w-full
                  object-cover
                "
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="
                  h-full
                  w-full
                  object-cover
                  [transform:scaleX(-1)]
                "
              />
            )}

            {/* CAMERA GUIDE */}
            {!preview && cameraReady && (
              <div className="
                pointer-events-none
                absolute
                inset-0
                flex
                items-center
                justify-center
              ">

                <div className="
                  h-[65%]
                  w-[55%]
                  rounded-[45%]
                  border-2
                  border-white/70
                  shadow-[0_0_0_9999px_rgba(0,0,0,0.20)]
                " />

              </div>
            )}


            {/* CAMERA ERROR */}
            {cameraError && !preview && (
              <div className="
                absolute
                inset-0
                flex
                flex-col
                items-center
                justify-center
                bg-gray-950
                px-6
                text-center
                text-white
              ">

                <Camera
                  size={42}
                  className="mb-4 opacity-60"
                />

                <p className="
                  max-w-sm
                  text-sm
                  text-gray-300
                ">
                  {cameraError}
                </p>

                <button
                  type="button"
                  onClick={startCamera}
                  className="
                    mt-4
                    inline-flex
                    items-center
                    gap-2
                    rounded-lg
                    bg-white
                    px-4
                    py-2
                    text-sm
                    font-medium
                    text-gray-800
                    hover:bg-gray-100
                  "
                >
                  <RefreshCw size={16} />
                  Aktifkan Kamera
                </button>

              </div>
            )}

          </div>


          {/* CAMERA ACTION */}
          <div className="p-5">

            <canvas
              ref={canvasRef}
              className="hidden"
            />

            {preview ? (
              <div className="
                flex
                gap-3
              ">

                <button
                  type="button"
                  onClick={resetPhoto}
                  disabled={loading}
                  className="
                    flex
                    flex-1
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    border
                    border-gray-200
                    bg-white
                    px-4
                    py-3
                    text-sm
                    font-semibold
                    text-gray-700
                    transition
                    hover:bg-gray-50
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  <X size={18} />
                  Foto Ulang
                </button>

                <button
                  type="button"
                  onClick={() => {
                    resetPhoto();
                  }}
                  disabled={loading}
                  className="
                    flex
                    flex-1
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-[#497F70]
                    px-4
                    py-3
                    text-sm
                    font-semibold
                    text-white
                    transition
                    hover:bg-[#3D6D60]
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  <CheckCircle2 size={18} />
                  Gunakan Foto
                </button>

              </div>
            ) : (
              <button
                type="button"
                onClick={takePhoto}
                disabled={
                  !cameraReady ||
                  loading
                }
                className="
                  flex
                  w-full
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  bg-[#497F70]
                  px-5
                  py-3
                  font-semibold
                  text-white
                  transition
                  hover:bg-[#3D6D60]
                  disabled:cursor-not-allowed
                  disabled:bg-gray-300
                "
              >
                <Camera size={20} />
                Ambil Selfie
              </button>
            )}

          </div>

        </div>


        {/* FORM */}
        <div className="
          h-fit
          rounded-2xl
          border
          border-[#DCE8E2]
          bg-white
          p-5
          shadow-sm
        ">

          <div className="mb-5">

            <h2 className="
              font-semibold
              text-[#173C32]
            ">
              Data Absensi
            </h2>

            <p className="
              mt-1
              text-xs
              text-gray-500
            ">
              Pilih karyawan dan lakukan absensi
            </p>

          </div>


          {/* EMPLOYEE */}
          <div className="mb-5">

            <label className="
              mb-2
              block
              text-sm
              font-semibold
              text-gray-700
            ">
              Karyawan
            </label>

            <select
              value={employeeId}
              onChange={(e) =>
                setEmployeeId(
                  e.target.value
                )
              }
              disabled={
                loading ||
                loadingEmployees
              }
              className="
                w-full
                rounded-xl
                border
                border-[#D5E5DC]
                bg-white
                px-4
                py-3
                text-sm
                outline-none
                transition
                focus:border-[#497F70]
                focus:ring-2
                focus:ring-[#497F70]/10
                disabled:bg-gray-50
              "
            >

              <option value="">
                {loadingEmployees
                  ? "Memuat karyawan..."
                  : "Pilih Karyawan"}
              </option>

              {employees.map(
                (employee) => (
                  <option
                    key={employee.id}
                    value={employee.id}
                  >
                    {employee.nik} -{" "}
                    {employee.name}
                  </option>
                )
              )}

            </select>

          </div>


          {/* SELECTED EMPLOYEE */}
          {selectedEmployee && (
            <div className="
              mb-5
              rounded-xl
              border
              border-[#DCE8E2]
              bg-[#F5F9F7]
              p-4
            ">

              <div className="
                flex
                items-start
                gap-3
              ">

                <div className="
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-[#497F70]/10
                  text-[#497F70]
                ">
                  <UserRound size={19} />
                </div>

                <div className="min-w-0">

                  <p className="
                    font-semibold
                    text-[#173C32]
                  ">
                    {selectedEmployee.name}
                  </p>

                  <p className="
                    mt-1
                    text-xs
                    text-gray-500
                  ">
                    NIK: {selectedEmployee.nik}
                  </p>

                  {selectedEmployee.position && (
                    <p className="
                      text-xs
                      text-gray-500
                    ">
                      {selectedEmployee.position}
                    </p>
                  )}

                  {selectedEmployee.department && (
                    <p className="
                      text-xs
                      text-gray-500
                    ">
                      {selectedEmployee.department}
                    </p>
                  )}

                </div>

              </div>

            </div>
          )}


          {/* PHOTO STATUS */}
          <div className="
            mb-5
            rounded-xl
            border
            border-dashed
            border-[#D5E5DC]
            p-4
          ">

            <div className="
              flex
              items-center
              justify-between
            ">

              <div className="
                flex
                items-center
                gap-3
              ">

                <div className={`
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-full
                  ${
                    photo
                      ? "bg-green-50 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }
                `}>

                  {photo ? (
                    <CheckCircle2
                      size={19}
                    />
                  ) : (
                    <Camera
                      size={19}
                    />
                  )}

                </div>

                <div>

                  <p className="
                    text-sm
                    font-semibold
                    text-gray-700
                  ">
                    Foto Selfie
                  </p>

                  <p className="
                    mt-0.5
                    text-xs
                    text-gray-500
                  ">
                    {photo
                      ? "Foto sudah siap"
                      : "Foto wajib diambil"}
                  </p>

                </div>

              </div>

              {photo && (
                <span className="
                  rounded-full
                  bg-green-50
                  px-2.5
                  py-1
                  text-xs
                  font-semibold
                  text-green-700
                ">
                  Siap
                </span>
              )}

            </div>

          </div>


          {/* ACTION */}
          <div className="
            grid
            grid-cols-1
            gap-3
            sm:grid-cols-2
          ">

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
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-green-600
                px-4
                py-3
                text-sm
                font-bold
                text-white
                transition
                hover:bg-green-700
                disabled:cursor-not-allowed
                disabled:bg-gray-300
              "
            >

              <LogIn size={19} />

              {loading
                ? "Proses..."
                : "Check In"}

            </button>


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
                flex
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-red-500
                px-4
                py-3
                text-sm
                font-bold
                text-white
                transition
                hover:bg-red-600
                disabled:cursor-not-allowed
                disabled:bg-gray-300
              "
            >

              <LogOut size={19} />

              {loading
                ? "Proses..."
                : "Check Out"}

            </button>

          </div>


          {/* INFO */}
          <div className="
            mt-5
            rounded-xl
            bg-[#F5F9F7]
            p-4
            text-xs
            leading-5
            text-gray-500
          ">

            <p className="
              font-semibold
              text-[#497F70]
            ">
              Informasi
            </p>

            <p className="mt-1">
              Pastikan karyawan sudah dipilih
              dan foto selfie sudah diambil
              sebelum melakukan Check In atau
              Check Out.
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}