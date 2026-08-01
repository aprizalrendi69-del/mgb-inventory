"use client";

import { useEffect,useState } from "react";

export default function CompanyPage(){

const [data,setData]=useState<any>({});

async function load(){

const res=await fetch("/api/company");

const json=await res.json();

if(json.success){

setData(json.data);

}

}

useEffect(()=>{

load();

},[]);

async function save(){

const res=await fetch("/api/company",{

method:"PUT",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify(data)

});

const json=await res.json();

if(json.success){

alert("Berhasil disimpan");

}else{

alert(json.message);

}

}

return(

<div className="p-8">

<h1 className="text-3xl font-bold mb-6">

Profil Perusahaan

</h1>

<div className="bg-white rounded-xl shadow p-6 space-y-4">
<div className="flex flex-col items-center mb-6">

  <img
    src={
      data.logo
        ? data.logo
        : "/no-image.png"
    }
    className="w-40 h-40 object-contain border rounded-lg bg-white"
  />

  <input
    type="text"
    className="border rounded w-full mt-3 p-3"
    placeholder="Path Logo (contoh: /uploads/logo.png)"
    value={data.logo ?? ""}
    onChange={(e)=>
      setData({
        ...data,
        logo:e.target.value
      })
    }
  />

  <p className="text-sm text-gray-500 mt-2">
    Upload logo ke folder <b>public/uploads</b>
    lalu isi:
    <br />
    /uploads/logo.png
  </p>

</div>
<input
className="border rounded w-full p-3"
placeholder="Nama Perusahaan"
value={data.name??""}
onChange={(e)=>setData({...data,name:e.target.value})}
/>

<input
className="border rounded w-full p-3"
placeholder="Alamat"
value={data.address??""}
onChange={(e)=>setData({...data,address:e.target.value})}
/>

<input
className="border rounded w-full p-3"
placeholder="Kota"
value={data.city??""}
onChange={(e)=>setData({...data,city:e.target.value})}
/>

<input
className="border rounded w-full p-3"
placeholder="Provinsi"
value={data.province??""}
onChange={(e)=>setData({...data,province:e.target.value})}
/>

<input
className="border rounded w-full p-3"
placeholder="Kode Pos"
value={data.postalCode??""}
onChange={(e)=>setData({...data,postalCode:e.target.value})}
/>

<input
className="border rounded w-full p-3"
placeholder="Telepon"
value={data.phone??""}
onChange={(e)=>setData({...data,phone:e.target.value})}
/>

<input
className="border rounded w-full p-3"
placeholder="Email"
value={data.email??""}
onChange={(e)=>setData({...data,email:e.target.value})}
/>

<input
className="border rounded w-full p-3"
placeholder="Website"
value={data.website??""}
onChange={(e)=>setData({...data,website:e.target.value})}
/>

<input
className="border rounded w-full p-3"
placeholder="NPWP"
value={data.npwp??""}
onChange={(e)=>setData({...data,npwp:e.target.value})}
/>

<input
className="border rounded w-full p-3"
placeholder="Direktur"
value={data.director??""}
onChange={(e)=>setData({...data,director:e.target.value})}
/>

<textarea
className="border rounded w-full p-3"
rows={3}
placeholder="Footer Print"
value={data.footer??""}
onChange={(e)=>setData({...data,footer:e.target.value})}
/>

<button

onClick={save}

className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded"

>

Simpan

</button>

</div>

</div>

);

}