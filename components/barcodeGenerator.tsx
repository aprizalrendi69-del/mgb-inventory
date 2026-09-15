"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface Props {
  value: string;
}

export default function BarcodeGenerator({
  value,
}: Props) {

  const barcodeRef =
    useRef<SVGSVGElement | null>(null);


  useEffect(() => {

    if (!barcodeRef.current) return;

    JsBarcode(
      barcodeRef.current,
      value,
      {
        format: "CODE128",

        width: 2,

        height: 80,

        displayValue: true,

        fontSize: 18,

        margin: 10,

      }
    );


  }, [value]);



  return (

    <svg
      ref={barcodeRef}
    />

  );

}