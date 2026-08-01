"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";

export default function NewEmployee(){

const router=useRouter();

const [nik,setNik]=useState("");

const [name,setName]=useState("");

const [department,setDepartment]=useState("");

const [position,setPosition]=useState("");

async function simpan(){

const res=await fetch("/api/employee",{

method:"POST",

headers:{

"Content-Type":"application/json"

},

body:JSON.stringify({

nik,

name,

department,

position

})

});

const json=await res.json();

alert(json.message);

if(json.success){

router.push("/karyawan");

}

}

return(

<div className="max-w-xl mx-auto p-8">

<h1 className="text-3xl font-bold mb-6">

Tambah Karyawan

</h1>

<div className="space-y-4">

<input

className="border p-3 w-full"

placeholder="NIK"

value={nik}

onChange={e=>setNik(e.target.value)}

/>

<input

className="border p-3 w-full"

placeholder="Nama"

value={name}

onChange={e=>setName(e.target.value)}

/>

<input

className="border p-3 w-full"

placeholder="Departemen"

value={department}

onChange={e=>setDepartment(e.target.value)}

/>

<input

className="border p-3 w-full"

placeholder="Jabatan"

value={position}

onChange={e=>setPosition(e.target.value)}

/>

<button

onClick={simpan}

className="bg-blue-600 text-white px-6 py-3 rounded"

>

Simpan

</button>

</div>

</div>

);

}