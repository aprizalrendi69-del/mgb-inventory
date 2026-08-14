"use client";

import { useEffect, useRef, useState } from "react";

import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";

interface Props {
  onScan: (barcode: string) => void;
}

export default function BarcodeInputScanner({
  onScan,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [value, setValue] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");

  // =====================================================
  // FOCUS INPUT
  // =====================================================

  useEffect(() => {
    if (!cameraOpen) {
      inputRef.current?.focus();
    }
  }, [cameraOpen]);

  // =====================================================
  // USB / BLUETOOTH SCANNER
  // =====================================================

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    setValue(e.target.value);
  }

  function handleKey(
    e: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (e.key !== "Enter") {
      return;
    }

    e.preventDefault();

    const code = value.trim();

    if (!code) {
      return;
    }

    console.log("USB/Bluetooth BARCODE:", code);

    onScan(code);

    setValue("");

    // Kembalikan fokus setelah proses scan
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }

  // =====================================================
  // START CAMERA
  // =====================================================

  async function startCamera() {
    try {
      setCameraError("");
      setCameraOpen(true);

      // Tunggu element kamera muncul
      await new Promise((resolve) =>
        setTimeout(resolve, 150)
      );

      const element =
        document.getElementById(
          "receive-barcode-camera"
        );

      if (!element) {
        throw new Error(
          "Element kamera tidak ditemukan."
        );
      }

      // Pastikan scanner lama tidak tertinggal
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {}

        try {
          await scannerRef.current.clear();
        } catch {}

        scannerRef.current = null;
      }

      const scanner = new Html5Qrcode(
        "receive-barcode-camera"
      );

      scannerRef.current = scanner;

      await scanner.start(
        {
          facingMode: "environment",
        },
        {
          fps: 10,

          qrbox: {
            width: 280,
            height: 180,
          },

          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,

            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,

            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,

            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
        },

        // =================================================
        // BERHASIL SCAN
        // =================================================

        async (decodedText) => {
          const code = decodedText.trim();

          if (!code) {
            return;
          }

          console.log(
            "CAMERA BARCODE:",
            code
          );

          onScan(code);

          await stopCamera();
        },

        // =================================================
        // ERROR FRAME
        // =================================================

        () => {
          // Jangan tampilkan error.
          // html5-qrcode akan memanggil callback ini
          // setiap kali frame belum berhasil dibaca.
        }
      );
    } catch (error) {
      console.error(
        "CAMERA SCANNER ERROR:",
        error
      );

      setCameraError(
        "Kamera tidak dapat digunakan. Pastikan izin kamera sudah diberikan."
      );

      setCameraOpen(false);

      scannerRef.current = null;
    }
  }

  // =====================================================
  // STOP CAMERA
  // =====================================================

  async function stopCamera() {
    try {
      const scanner =
        scannerRef.current;

      scannerRef.current = null;

      if (scanner) {
        try {
          await scanner.stop();
        } catch (error) {
          console.error(
            "SCANNER STOP ERROR:",
            error
          );
        }

        try {
          await scanner.clear();
        } catch (error) {
          console.error(
            "SCANNER CLEAR ERROR:",
            error
          );
        }
      }
    } finally {
      setCameraOpen(false);
    }
  }

  // =====================================================
  // CLEANUP
  // =====================================================

  useEffect(() => {
    return () => {
      const scanner =
        scannerRef.current;

      scannerRef.current = null;

      if (scanner) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => {
            scanner
              .clear()
              .catch(() => {});
          });
      }
    };
  }, []);

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="space-y-3">

      {/* ================================================= */}
      {/* USB / BLUETOOTH */}
      {/* ================================================= */}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Barcode Scanner USB / Bluetooth
        </label>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder="Scan barcode..."
          autoComplete="off"
          className="
            w-full
            rounded-lg
            border
            border-gray-300
            px-3
            py-2
            outline-none
            focus:border-[#497F70]
            focus:ring-2
            focus:ring-[#497F70]/10
          "
        />

        <p className="mt-1 text-xs text-gray-400">
          Bisa menggunakan scanner USB atau Bluetooth
          yang bekerja sebagai keyboard.
        </p>
      </div>

      {/* ================================================= */}
      {/* CAMERA BUTTON */}
      {/* ================================================= */}

      {!cameraOpen ? (
        <button
          type="button"
          onClick={startCamera}
          className="
            w-full
            rounded-lg
            bg-blue-600
            px-4
            py-2
            font-medium
            text-white
            transition
            hover:bg-blue-700
          "
        >
          📷 Scan dengan Kamera HP
        </button>
      ) : (
        <button
          type="button"
          onClick={stopCamera}
          className="
            w-full
            rounded-lg
            bg-red-600
            px-4
            py-2
            font-medium
            text-white
            transition
            hover:bg-red-700
          "
        >
          ✕ Tutup Kamera
        </button>
      )}

      {/* ================================================= */}
      {/* CAMERA */}
      {/* ================================================= */}

      {cameraOpen && (
        <div className="overflow-hidden rounded-xl border bg-black">

          <div
            id="receive-barcode-camera"
            className="w-full"
          />

          <div className="py-2 text-center text-xs text-white">
            Arahkan kamera ke barcode atau QR Batch
          </div>

        </div>
      )}

      {/* ================================================= */}
      {/* CAMERA ERROR */}
      {/* ================================================= */}

      {cameraError && (
        <div className="
          rounded-lg
          border
          border-red-200
          bg-red-50
          px-3
          py-2
          text-sm
          text-red-700
        ">
          {cameraError}
        </div>
      )}

    </div>
  );
}