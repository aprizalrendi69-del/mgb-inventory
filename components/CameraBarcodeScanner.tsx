"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

interface Props {
  onScan: (barcode: string) => void;
}

export default function CameraBarcodeScanner({
  onScan,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraError, setCameraError] = useState("");
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let mounted = true;
    let scanLocked = false;

    async function startCamera() {
      try {
        setStarting(true);
        setCameraError("");

        console.log("=== START CAMERA ===");

        if (
          typeof navigator === "undefined" ||
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          throw new Error(
            "Browser tidak mendukung kamera."
          );
        }

        const video = videoRef.current;

        if (!video) {
          throw new Error(
            "Element video tidak ditemukan."
          );
        }

        /*
         * Buka kamera terlebih dahulu.
         * Menggunakan kamera belakang jika tersedia.
         */
        const stream =
          await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: {
                ideal: "environment",
              },
              width: {
                ideal: 1280,
              },
              height: {
                ideal: 720,
              },
            },
            audio: false,
          });

        if (!mounted) {
          stream
            .getTracks()
            .forEach((track) => track.stop());

          return;
        }

        streamRef.current = stream;

        console.log(
          "CAMERA STREAM BERHASIL"
        );

        console.log(
          "CAMERA SETTINGS:",
          stream
            .getVideoTracks()
            .map((track) =>
              track.getSettings()
            )
        );

        /*
         * Hubungkan stream ke video.
         */
        video.srcObject = stream;
        video.setAttribute(
          "playsinline",
          "true"
        );
        video.setAttribute(
          "autoplay",
          "true"
        );
        video.muted = true;

        await video.play();

        if (!mounted) {
          return;
        }

        console.log(
          "VIDEO BERHASIL PLAY"
        );

        /*
         * Buat ZXing reader.
         */
        const reader =
          new BrowserMultiFormatReader();

        readerRef.current = reader;

        /*
         * Jalankan scanner.
         *
         * Kita menggunakan stream kamera
         * yang sudah dibuka sebelumnya.
         */
        await reader.decodeFromStream(
          stream,
          video,
          (result, error) => {
            if (!mounted) {
              return;
            }

            /*
             * Setelah barcode berhasil dibaca,
             * jangan baca berkali-kali.
             */
            if (result && !scanLocked) {
              scanLocked = true;

              const text =
                result
                  .getText()
                  .trim();

              if (!text) {
                scanLocked = false;
                return;
              }

              console.log(
                "BARCODE TERBACA:",
                text
              );

              onScan(text);

              /*
               * Stop scanner setelah berhasil.
               */
              try {
                reader.reset();
              } catch {}

              return;
            }

            /*
             * NotFoundException,
             * ChecksumException,
             * No Micro QR finder pattern,
             * dll adalah normal ketika kamera
             * sedang mencari barcode.
             *
             * Jangan console.error.
             */
            void error;
          }
        );

        console.log(
          "ZXING SCANNER AKTIF"
        );
      } catch (error: any) {
        console.error(
          "CAMERA START ERROR:",
          error
        );

        if (!mounted) {
          return;
        }

        let message =
          "Kamera tidak dapat dibuka.";

        if (
          error?.name ===
          "NotAllowedError"
        ) {
          message =
            "Izin kamera ditolak. Izinkan kamera pada browser.";
        } else if (
          error?.name ===
          "NotReadableError"
        ) {
          message =
            "Kamera sedang digunakan aplikasi atau browser lain.";
        } else if (
          error?.name ===
          "NotFoundError"
        ) {
          message =
            "Kamera tidak ditemukan pada perangkat.";
        } else if (
          error?.name ===
          "OverconstrainedError"
        ) {
          message =
            "Kamera tidak mendukung pengaturan yang diminta.";
        } else if (
          error?.message
        ) {
          message =
            error.message;
        }

        setCameraError(message);
      } finally {
        if (mounted) {
          setStarting(false);
        }
      }
    }

    startCamera();

    return () => {
      mounted = false;
      scanLocked = true;

      console.log(
        "=== STOP CAMERA ==="
      );

      /*
       * Stop ZXing.
       */
      try {
        readerRef.current?.reset();
      } catch {}

      readerRef.current = null;

      /*
       * Stop kamera.
       */
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => {
            try {
              track.stop();
            } catch {}
          });

        streamRef.current = null;
      }

      /*
       * Bersihkan video.
       */
      if (videoRef.current) {
        try {
          videoRef.current.pause();
        } catch {}

        videoRef.current.srcObject =
          null;
      }
    };
  }, [onScan]);

  return (
    <div className="w-full">
      <div
        className="
          relative
          w-full
          h-[300px]
          bg-black
          rounded-xl
          overflow-hidden
          border
          border-gray-200
        "
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="
            w-full
            h-full
            object-cover
          "
        />

        {/* Scanner frame */}
        <div
          className="
            absolute
            inset-0
            flex
            items-center
            justify-center
            pointer-events-none
          "
        >
          <div
            className="
              relative
              w-[78%]
              h-[36%]
              border-2
              border-white
              rounded-xl
              shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]
            "
          >
            {/* Corner indicators */}
            <span
              className="
                absolute
                -top-[2px]
                -left-[2px]
                w-8
                h-8
                border-t-4
                border-l-4
                border-white
                rounded-tl-lg
              "
            />

            <span
              className="
                absolute
                -top-[2px]
                -right-[2px]
                w-8
                h-8
                border-t-4
                border-r-4
                border-white
                rounded-tr-lg
              "
            />

            <span
              className="
                absolute
                -bottom-[2px]
                -left-[2px]
                w-8
                h-8
                border-b-4
                border-l-4
                border-white
                rounded-bl-lg
              "
            />

            <span
              className="
                absolute
                -bottom-[2px]
                -right-[2px]
                w-8
                h-8
                border-b-4
                border-r-4
                border-white
                rounded-br-lg
              "
            />

            {/* Scan line */}
            {!cameraError && !starting && (
              <div
                className="
                  absolute
                  left-3
                  right-3
                  top-1/2
                  h-[2px]
                  bg-white/90
                  shadow-[0_0_8px_rgba(255,255,255,0.9)]
                  animate-pulse
                "
              />
            )}
          </div>
        </div>

        {/* Loading */}
        {starting && !cameraError && (
          <div
            className="
              absolute
              inset-0
              flex
              items-center
              justify-center
              bg-black/60
              text-white
              text-sm
              font-medium
            "
          >
            <div className="text-center">
              <div className="mb-2">
                Membuka kamera...
              </div>

              <div className="text-xs text-white/70">
                Izinkan akses kamera jika diminta
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {cameraError && (
          <div
            className="
              absolute
              inset-0
              flex
              items-center
              justify-center
              p-6
              text-center
              bg-black/75
              text-white
            "
          >
            <div>
              <div className="text-red-400 font-bold mb-2">
                Kamera tidak dapat dibuka
              </div>

              <div className="text-sm text-white/90">
                {cameraError}
              </div>
            </div>
          </div>
        )}

        {/* Camera active indicator */}
        {!starting && !cameraError && (
          <div
            className="
              absolute
              top-3
              left-3
              flex
              items-center
              gap-2
              px-3
              py-1.5
              rounded-full
              bg-black/60
              text-white
              text-xs
              backdrop-blur-sm
            "
          >
            <span
              className="
                w-2
                h-2
                rounded-full
                bg-green-400
                animate-pulse
              "
            />

            Kamera aktif
          </div>
        )}
      </div>

      <div
        className="
          mt-2
          text-center
          text-xs
          text-gray-500
        "
      >
        Arahkan kamera ke barcode barang
      </div>
    </div>
  );
}