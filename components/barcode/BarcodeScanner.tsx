"use client";

import { useEffect, useRef } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";

interface Props {
  onScan: (barcode: string) => void;
}

export default function BarcodeScanner({
  onScan,
}: Props) {

  const scanner =
    useRef<Html5Qrcode | null>(null);


  useEffect(() => {

    let mounted = true;


    async function start() {

      if (!mounted) return;


      const qrScanner =
        new Html5Qrcode(
          "barcode-reader",
          {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.CODE128,
              Html5QrcodeSupportedFormats.CODE39,
              Html5QrcodeSupportedFormats.EAN13,
              Html5QrcodeSupportedFormats.EAN8,
              Html5QrcodeSupportedFormats.UPC_A,
            ],
          }
        );


      scanner.current = qrScanner;


      try {

        const cameras =
          await Html5Qrcode.getCameras();


        console.log(
          "CAMERA LIST:",
          cameras
        );


        if (!cameras.length) {
          console.log(
            "Kamera tidak ditemukan"
          );
          return;
        }


        // pilih kamera belakang kalau ada
        let cameraId =
          cameras[0].id;


        const backCamera =
          cameras.find(
            cam =>
              cam.label
                .toLowerCase()
                .includes("back")
                ||
              cam.label
                .toLowerCase()
                .includes("rear")
          );


        if(backCamera){
          cameraId =
            backCamera.id;
        }


        await qrScanner.start(

          cameraId,

          {
            fps: 15,

            qrbox:{
              width:300,
              height:180,
            },

            aspectRatio:1.777,

          },


          (text)=>{

            console.log(
              "SCAN:",
              text
            );

            onScan(text);

          },


          ()=>{}

        );


      } catch(error){

        console.error(
          "START CAMERA ERROR",
          error
        );

      }

    }


    start();


    return ()=>{

      mounted=false;


      if(scanner.current){

        scanner.current
          .stop()
          .then(()=>{

            scanner.current?.clear();

          })
          .catch(()=>{});

      }

    };


  },[onScan]);



  return (
    <div
      id="barcode-reader"
      style={{
        width:"100%",
        minHeight:"300px"
      }}
    />
  );

}