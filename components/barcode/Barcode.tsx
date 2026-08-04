"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeProps {
  value: string;
}

export default function Barcode({
  value,
}: BarcodeProps) {

  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {

    if (!svgRef.current) return;

    JsBarcode(svgRef.current, value, {
      format: "CODE128",
      width: 1.5,
      height: 45,
      displayValue: true,
      fontSize: 13,
      margin: 0,
      background: "#ffffff",
      lineColor: "#000000",
    });

  }, [value]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-auto"
    />
  );

}