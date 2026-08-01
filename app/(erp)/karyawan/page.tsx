"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function EmployeePage() {

  const [employee,setEmployee]=useState<any[]>([]);

  async function load(){

    const res=await fetch("/api/employee");

    const json=await res.json();

    if(json.success){

      setEmployee(json.data);

    }

  }

  useEffect(()=>{

    load();

  },[]);

  async function hapus(id:number){

    if(!confirm("Hapus karyawan?")) return;

    const res=await fetch("/api/employee/"+id,{

      method:"DELETE"

    });

    const json=await res.json();

    alert(json.message);

    if(json.success){

      load();

    }

  }

  return(

<div className="p-8">

<div className="flex justify-between mb-6">

<h1 className="text-3xl font-bold">

Master Karyawan

</h1>

<Link

href="/karyawan/new"

className="bg-blue-600 text-white px-5 py-2 rounded"

>

+ Karyawan

</Link>

</div>

<table className="w-full border">

<thead>

<tr className="bg-gray-100">

<th className="border p-2">NIK</th>

<th className="border p-2">Nama</th>

<th className="border p-2">Jabatan</th>

<th className="border p-2">Departemen</th>

<th className="border p-2">Status</th>

<th className="border p-2">Aksi</th>

</tr>

</thead>

<tbody>

{

employee.map((e:any)=>(

<tr key={e.id}>

<td className="border p-2">{e.nik}</td>

<td className="border p-2">{e.name}</td>

<td className="border p-2">{e.position}</td>

<td className="border p-2">{e.department}</td>

<td className="border p-2">

{e.active?"Aktif":"Non Aktif"}

</td>

<td className="border p-2">

<div className="flex gap-2">

<Link

href={"/karyawan/"+e.id+"/edit"}

className="bg-yellow-500 text-white px-3 py-1 rounded"

>

Edit

</Link>

<button

onClick={()=>hapus(e.id)}

className="bg-red-600 text-white px-3 py-1 rounded"

>

Hapus

</button>

</div>

</td>

</tr>

))

}

</tbody>

</table>

</div>

);

}