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
        width: 180,
        margin: 2,
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

  return (
    <div className="flex flex-col items-center justify-center">
      <canvas
        ref={canvasRef}
        className="h-auto w-[180px]"
      />

      <div className="mt-1 text-center text-sm font-semibold text-black">
        {value}
      </div>
    </div>
  );
}