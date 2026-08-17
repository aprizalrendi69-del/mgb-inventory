"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface BarcodeProps {
  value: string;
}

export default function Barcode({
  value,
}: BarcodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    QRCode.toCanvas(
      canvasRef.current,
      value,
      {
        width: 256,
        height: 256,
        margin: 0,
        errorCorrectionLevel: "M",
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      },
      (error) => {
        if (error) {
          console.error(
            "GAGAL GENERATE QR CODE:",
            error
          );
        }
      }
    );
  }, [value]);

  if (!value) return null;

  return (
    <div
      className="
        flex
        w-[40mm]
        h-[30mm]
        flex-col
        items-center
        justify-center
        overflow-hidden
        bg-white
        text-black
      "
    >
      {/* QR CODE */}

      <canvas
        ref={canvasRef}
        className="
          block
          h-[16mm]
          w-[16mm]
        "
      />

      {/* KODE */}

      <div
        className="
          mt-[1mm]
          max-w-[34mm]
          truncate
          text-center
          text-[2.5mm]
          font-semibold
          leading-none
        "
      >
        {value}
      </div>
    </div>
  );
}