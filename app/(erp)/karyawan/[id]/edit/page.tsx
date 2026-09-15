"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EditEmployeePage() {

  const params = useParams();
  const router = useRouter();

  const [loading,setLoading]=useState(true);

  const [nik,setNik]=useState("");
  const [name,setName]=useState("");
  const [department,setDepartment]=useState("");
  const [position,setPosition]=useState("");
  const [phone,setPhone]=useState("");
  const [address,setAddress]=useState("");
  const [active,setActive]=useState(true);

  async function load(){

    const res=await fetch("/api/employee/"+params.id);

    const json=await res.json();

    if(json.success){

      const e=json.data;

      setNik(e.nik);
      setName(e.name);
      setDepartment(e.department||"");
      setPosition(e.position||"");
      setPhone(e.phone||"");
      setAddress(e.address||"");
      setActive(e.active);

    }else{

      alert(json.message);

      router.push("/karyawan");

    }

    setLoading(false);

  }

  useEffect(()=>{

    load();

  },[]);

  async function simpan(){

    const res=await fetch("/api/employee/"+params.id,{

      method:"PUT",

      headers:{
        "Content-Type":"application/json"
      },

      body:JSON.stringify({

        nik,
        name,
        department,
        position,
        phone,
        address,
        active

      })

    });

    const json=await res.json();

    alert(json.message);

    if(json.success){

      router.push("/karyawan");

    }

  }

  if(loading){

    return(

      <div className="p-8">

        Loading...

      </div>

    );

  }

  return(

    <div className="p-8">

      <h1 className="text-3xl font-bold mb-6">

        Edit Karyawan

      </h1>

      <div className="bg-white shadow rounded-lg p-6 space-y-4">

        <div>

          <label>NIK</label>

          <input
            className="border p-3 rounded w-full"
            value={nik}
            onChange={e=>setNik(e.target.value)}
          />

        </div>

        <div>

          <label>Nama</label>

          <input
            className="border p-3 rounded w-full"
            value={name}
            onChange={e=>setName(e.target.value)}
          />

        </div>

        <div>

          <label>Departemen</label>

          <input
            className="border p-3 rounded w-full"
            value={department}
            onChange={e=>setDepartment(e.target.value)}
          />

        </div>

        <div>

          <label>Jabatan</label>

          <input
            className="border p-3 rounded w-full"
            value={position}
            onChange={e=>setPosition(e.target.value)}
          />

        </div>

        <div>

          <label>Telepon</label>

          <input
            className="border p-3 rounded w-full"
            value={phone}
            onChange={e=>setPhone(e.target.value)}
          />

        </div>

        <div>

          <label>Alamat</label>

          <textarea
            className="border p-3 rounded w-full"
            rows={4}
            value={address}
            onChange={e=>setAddress(e.target.value)}
          />

        </div>

        <div className="flex items-center gap-2">

          <input
            type="checkbox"
            checked={active}
            onChange={e=>setActive(e.target.checked)}
          />

          <label>Aktif</label>

        </div>

        <div className="flex gap-3">

          <button
            onClick={simpan}
            className="bg-blue-600 text-white px-6 py-2 rounded"
          >
            Simpan
          </button>

          <button
            onClick={()=>router.back()}
            className="bg-gray-500 text-white px-6 py-2 rounded"
          >
            Batal
          </button>

        </div>

      </div>

    </div>

  );

}