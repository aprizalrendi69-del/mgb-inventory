"use client";

import {useRouter} from "next/navigation";
import {useState} from "react";

export default function NewSupplier(){

const router=useRouter();

const [form,setForm]=useState({

code:"",
name:"",
address:"",
city:"",
phone:"",
email:"",
pic:""

});

async function simpan(){

await fetch("/api/supplier",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify(form)

});

router.push("/supplier");

}

return(

<div className="p-8 max-w-xl">

<h1 className="text-3xl font-bold mb-6">

Supplier Baru

</h1>

<div className="space-y-3">

<input
className="border p-2 w-full"
placeholder="Kode"
onChange={e=>setForm({...form,code:e.target.value})}
/>

<input
className="border p-2 w-full"
placeholder="Nama"
onChange={e=>setForm({...form,name:e.target.value})}
/>

<textarea
className="border p-2 w-full"
placeholder="Alamat"
onChange={e=>setForm({...form,address:e.target.value})}
/>

<input
className="border p-2 w-full"
placeholder="Kota"
onChange={e=>setForm({...form,city:e.target.value})}
/>

<input
className="border p-2 w-full"
placeholder="PIC"
onChange={e=>setForm({...form,pic:e.target.value})}
/>

<input
className="border p-2 w-full"
placeholder="Telepon"
onChange={e=>setForm({...form,phone:e.target.value})}
/>

<input
className="border p-2 w-full"
placeholder="Email"
onChange={e=>setForm({...form,email:e.target.value})}
/>

<button
onClick={simpan}
className="bg-blue-600 text-white px-6 py-2 rounded"
>

Simpan

</button>

</div>

</div>

);

}