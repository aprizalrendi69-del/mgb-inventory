"use client";

import { useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";


interface Props {
  onScan:(barcode:string)=>void;
}


export default function CameraBarcodeScanner({
  onScan
}:Props){


const videoRef =
useRef<HTMLVideoElement|null>(null);


const readerRef =
useRef<BrowserMultiFormatReader|null>(null);


const runningRef =
useRef(false);



useEffect(()=>{


const start = async()=>{


try{


const reader =
new BrowserMultiFormatReader();


readerRef.current = reader;



const devices =
await BrowserMultiFormatReader.listVideoInputDevices();



if(devices.length===0){

console.error(
"Tidak ada kamera"
);

return;

}



const cameraId =
devices[0].deviceId;



runningRef.current=true;



await reader.decodeFromVideoDevice(

cameraId,

videoRef.current!,

(result,error)=>{


if(result){


const text =
result.getText();


if(text){

onScan(text);

}

}


}

);



}catch(err){


console.error(
"CAMERA ERROR",
err
);


}


};



start();



return()=>{


if(readerRef.current && runningRef.current){


try{


readerRef.current.stopContinuousDecode();


}catch(e){


console.log(
"stop camera selesai"
);


}


}



runningRef.current=false;


};


},[]);



return (

<div>


<video

ref={videoRef}

className="
w-full
rounded-xl
"

style={{

width:"100%",

height:"300px",

objectFit:"cover"

}}

/>


</div>


);


}