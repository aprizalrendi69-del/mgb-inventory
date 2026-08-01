"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewEmployeePage(){

const router=useRouter();

const [nik,setNik]=useState("");

const [name,setName]=useState("");

const [department,setDepartment]=useState("");

const [position,setPosition]=useState("");

const [phone,setPhone]=useState("");

const [address,setAddress]=useState("");

async function simpan(){

if(!nik || !name){

alert("NIK dan Nama wajib diisi");

return;

}

const res=await fetch("/api/employee",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

nik,

name,

department,

position,

phone,

address

})

});

const json=await res.json();

if(json.success){

alert("Pegawai berhasil ditambahkan");

router.push("/employee");

}else{

alert(json.message);

}

}

return(

<div className="p-8 max-w-3xl">

<h1 className="text-3xl font-bold mb-8">

Tambah Pegawai

</h1>

<div className="space-y-5">

<input
className="border w-full p-3 rounded"
placeholder="NIK"
value={nik}
onChange={e=>setNik(e.target.value)}
/>

<input
className="border w-full p-3 rounded"
placeholder="Nama Pegawai"
value={name}
onChange={e=>setName(e.target.value)}
/>

<input
className="border w-full p-3 rounded"
placeholder="Departemen"
value={department}
onChange={e=>setDepartment(e.target.value)}
/>

<input
className="border w-full p-3 rounded"
placeholder="Jabatan"
value={position}
onChange={e=>setPosition(e.target.value)}
/>

<input
className="border w-full p-3 rounded"
placeholder="No HP"
value={phone}
onChange={e=>setPhone(e.target.value)}
/>

<textarea
className="border w-full p-3 rounded"
placeholder="Alamat"
rows={4}
value={address}
onChange={e=>setAddress(e.target.value)}
/>

<button

onClick={simpan}

className="bg-blue-600 text-white px-8 py-3 rounded"

>

Simpan Pegawai

</button>

</div>

</div>

);

}