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

    async function startCamera() {
      try {
        setStarting(true);
        setCameraError("");

        console.log("=== START CAMERA ===");

        if (!navigator.mediaDevices) {
          throw new Error(
            "Browser tidak mendukung kamera."
          );
        }

        /*
         * Minta izin kamera terlebih dahulu.
         *
         * facingMode environment =
         * kamera belakang HP.
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
          "CAMERA STREAM BERHASIL:"
        );

        console.log(
          stream
            .getVideoTracks()
            .map((track) =>
              track.getSettings()
            )
        );

        const video =
          videoRef.current;

        if (!video) {
          throw new Error(
            "Element video tidak ditemukan."
          );
        }

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

        console.log(
          "VIDEO BERHASIL PLAY"
        );

        /*
         * ZXING
         */

        const reader =
          new BrowserMultiFormatReader();

        readerRef.current = reader;

        /*
         * Setelah kamera berhasil dibuka,
         * ambil daftar device kamera.
         */

        let devices: MediaDeviceInfo[] = [];

        try {
          devices =
            await BrowserMultiFormatReader.listVideoInputDevices();

          console.log(
            "DAFTAR KAMERA:",
            devices
          );
        } catch (error) {
          console.warn(
            "Tidak bisa membaca daftar kamera:",
            error
          );
        }

        /*
         * Cari kamera belakang.
         */

        let selectedCameraId =
          devices[0]?.deviceId;

        const backCamera =
          devices.find((device) => {

            const label =
              device.label.toLowerCase();

            return (
              label.includes("back") ||
              label.includes("rear") ||
              label.includes("environment") ||
              label.includes("belakang")
            );
          });

        if (backCamera) {
          selectedCameraId =
            backCamera.deviceId;

          console.log(
            "KAMERA BELAKANG DIPILIH:",
            backCamera.label
          );
        } else {
          console.log(
            "Kamera belakang tidak ditemukan dari label."
          );
        }

        if (!selectedCameraId) {
          throw new Error(
            "Tidak ada kamera yang tersedia."
          );
        }

        /*
         * Jalankan ZXing.
         *
         * Jangan memanggil getUserMedia
         * kedua kali secara agresif.
         */

        await reader.decodeFromVideoDevice(
          selectedCameraId,
          video,
          (result, error) => {

            if (!mounted) {
              return;
            }

            if (result) {

              const text =
                result
                  .getText()
                  .trim();

              if (!text) {
                return;
              }

              console.log(
                "BARCODE TERBACA:",
                text
              );

              onScan(text);

              /*
               * Setelah berhasil membaca,
               * hentikan scanner supaya tidak
               * membaca barcode berkali-kali.
               */

              try {
                reader.reset();
              } catch {}

              return;
            }

            /*
             * Error seperti NotFoundException
             * adalah NORMAL ketika kamera
             * belum menemukan barcode.
             *
             * Jadi jangan console.error.
             */

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
        }

        if (
          error?.name ===
          "NotReadableError"
        ) {
          message =
            "Kamera sedang digunakan aplikasi/browser lain.";
        }

        if (
          error?.name ===
          "NotFoundError"
        ) {
          message =
            "Kamera tidak ditemukan pada perangkat.";
        }

        if (
          error?.name ===
          "OverconstrainedError"
        ) {
          message =
            "Kamera tidak mendukung pengaturan yang diminta.";
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

      console.log(
        "=== STOP CAMERA ==="
      );

      /*
       * Stop ZXing
       */

      try {
        readerRef.current?.reset();
      } catch {}

      readerRef.current = null;

      /*
       * Stop kamera
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
       * Bersihkan video
       */

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
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
              w-[75%]
              h-[35%]
              border-2
              border-white
              rounded-xl
              shadow-lg
            "
          />

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
              bg-black/50
              text-white
              text-sm
            "
          >
            Membuka kamera...
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
              bg-black/70
              text-white
            "
          >

            <div>

              <div className="text-red-400 font-bold mb-2">
                Kamera tidak dapat dibuka
              </div>

              <div className="text-sm">
                {cameraError}
              </div>

            </div>

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