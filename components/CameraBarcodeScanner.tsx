"use client";

import { useEffect, useRef } from "react";
import {
  BrowserMultiFormatReader,
} from "@zxing/browser";


interface Props {
  onScan:(barcode:string)=>void;
}


export default function CameraBarcodeScanner({
  onScan
}:Props){


  const videoRef =
    useRef<HTMLVideoElement | null>(null);



  useEffect(()=>{


    const codeReader =
      new BrowserMultiFormatReader();



    async function start(){


      try{


        const devices =
          await BrowserMultiFormatReader
          .listVideoInputDevices();



        const backCamera =
          devices.find(
            d =>
            d.label
            .toLowerCase()
            .includes("back")
            ||
            d.label
            .toLowerCase()
            .includes("rear")
          );



        const deviceId =
          backCamera
          ? backCamera.deviceId
          : devices[0]?.deviceId;



        await codeReader.decodeFromVideoDevice(

          deviceId,

          videoRef.current!,

          (result)=>{


            if(result){


              const text =
              result.getText();



              console.log(
                "ZXING SCAN:",
                text
              );


              onScan(text);



              codeReader.reset();

            }


          }

        );



      }catch(err){

        console.error(
          err
        );

      }


    }


    start();



    return()=>{

      codeReader.reset();

    };


  },[onScan]);



  return (

    <video
      ref={videoRef}
      style={{
        width:"100%",
        borderRadius:"12px"
      }}
    />

  );

}