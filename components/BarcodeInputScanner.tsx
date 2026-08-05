"use client";

import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function BarcodeInputScanner({
  onScan,
}: {
  onScan: (barcode: string) => void;
}) {

  const scanner = useRef<Html5Qrcode | null>(null);
  const scanned = useRef(false);


  useEffect(() => {

    const id = "stock-camera";

    const qr = new Html5Qrcode(id);

    scanner.current = qr;


    qr.start(
      {
        facingMode: "environment",
      },
      {
        fps: 10,
        qrbox: {
          width: 280,
          height: 150,
        },
      },
      async (barcode)=>{

        if(scanned.current) return;

        scanned.current = true;

        onScan(barcode);


        setTimeout(()=>{

          scanned.current=false;

        },1500);

      },
      ()=>{}
    )
    .catch(console.error);



    return ()=>{

      qr.stop()
      .then(()=>qr.clear())
      .catch(()=>{});

    };


  },[onScan]);



  return (
    <div
      id="stock-camera"
      style={{
        width:"100%",
        maxWidth:400
      }}
    />
  );

}