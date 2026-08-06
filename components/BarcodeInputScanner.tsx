"use client";


import {
useEffect,
useRef,
useState
} from "react";



interface Props{

onScan:(barcode:string)=>void;

}



export default function BarcodeInputScanner({

onScan

}:Props){



const [value,setValue]=
useState("");



const inputRef =
useRef<HTMLInputElement|null>(null);



useEffect(()=>{


inputRef.current?.focus();



},[]);




function handleChange(
e:React.ChangeEvent<HTMLInputElement>
){


const val =
e.target.value;



setValue(val);



}



function handleKey(
e:React.KeyboardEvent<HTMLInputElement>
){



if(e.key==="Enter"){


const code =
value.trim();



if(code){


onScan(code);


}



setValue("");



}



}




return (


<input


ref={inputRef}


className="
border
p-3
rounded
w-full
"


placeholder="Scan barcode..."


value={value}


onChange={handleChange}


onKeyDown={handleKey}


/>



);


}