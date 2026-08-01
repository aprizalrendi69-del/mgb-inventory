"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";


export default function EditEmployeePage(){

  const params = useParams();
  const router = useRouter();

  const id = params.id;


  const [form,setForm]=useState({

    nik:"",
    name:"",
    department:"",
    position:"",
    phone:"",
    address:"",
    active:true

  });



  useEffect(()=>{

    if(id){
      loadData();
    }

  },[id]);



  async function loadData(){

    const res = await fetch(
      `/api/employee/${id}`
    );

    const json = await res.json();


    if(json.success){

      setForm(json.data);

    }

  }



  function change(
    e:React.ChangeEvent<HTMLInputElement>
  ){

    setForm({

      ...form,

      [e.target.name]:e.target.value

    });

  }



  async function save(){


    const res = await fetch(
      `/api/employee/${id}`,
      {

        method:"PUT",

        headers:{
          "Content-Type":"application/json"
        },

        body:JSON.stringify(form)

      }
    );


    const json = await res.json();


    if(json.success){

      alert("Berhasil diubah");

      router.push("/employee");

    }else{

      alert(json.message);

    }

  }



  return (

    <div className="max-w-xl mx-auto p-8">

      <h1 className="text-3xl font-bold mb-6">
        Edit Karyawan
      </h1>


      <div className="space-y-4">


        <input
          name="nik"
          value={form.nik}
          onChange={change}
          placeholder="NIK"
          className="border p-3 w-full rounded"
        />


        <input
          name="name"
          value={form.name}
          onChange={change}
          placeholder="Nama"
          className="border p-3 w-full rounded"
        />


        <input
          name="department"
          value={form.department || ""}
          onChange={change}
          placeholder="Departemen"
          className="border p-3 w-full rounded"
        />


        <input
          name="position"
          value={form.position || ""}
          onChange={change}
          placeholder="Jabatan"
          className="border p-3 w-full rounded"
        />


        <input
          name="phone"
          value={form.phone || ""}
          onChange={change}
          placeholder="No HP"
          className="border p-3 w-full rounded"
        />


        <input
          name="address"
          value={form.address || ""}
          onChange={change}
          placeholder="Alamat"
          className="border p-3 w-full rounded"
        />


        <button
          onClick={save}
          className="bg-blue-600 text-white px-6 py-3 rounded"
        >
          Simpan Perubahan
        </button>


      </div>

    </div>

  );

}