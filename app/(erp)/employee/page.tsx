"use client";

import { useEffect, useState } from "react";
import Link from "next/link";


export default function EmployeePage(){

  const [employees,setEmployees]=useState<any[]>([]);


  useEffect(()=>{

    loadData();

  },[]);



  async function loadData(){

    const res = await fetch("/api/employee");

    const json = await res.json();


    if(json.success){

      setEmployees(json.data);

    }

  }



  async function removeEmployee(id:number){

    const yakin = confirm(
      "Yakin hapus karyawan ini?"
    );


    if(!yakin) return;



    const res = await fetch(
      `/api/employee/${id}`,
      {
        method:"DELETE"
      }
    );


    const json = await res.json();


    if(json.success){

      alert("Berhasil dihapus");

      loadData();

    }

  }



  return (

    <div className="p-8">


      <div className="flex justify-between items-center mb-6">


        <h1 className="text-3xl font-bold">
          Master Employee
        </h1>


        <Link
          href="/employee/new"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Tambah Karyawan
        </Link>


      </div>



      <div className="bg-white shadow rounded overflow-hidden">


        <table className="w-full">


          <thead className="bg-gray-100">

            <tr>

              <th className="border p-3">
                NIK
              </th>

              <th className="border p-3">
                Nama
              </th>

              <th className="border p-3">
                Jabatan
              </th>

              <th className="border p-3">
                Aksi
              </th>

            </tr>

          </thead>



          <tbody>


          {employees.map((item)=>(
            
            <tr key={item.id}>


              <td className="border p-3">
                {item.nik}
              </td>


              <td className="border p-3">
                {item.name}
              </td>


              <td className="border p-3">
                {item.position}
              </td>


              <td className="border p-3">


                <div className="flex gap-2">


                  <Link
                    href={`/employee/${item.id}/edit`}
                    className="bg-yellow-500 text-white px-3 py-1 rounded"
                  >
                    Edit
                  </Link>



                  <button
                    onClick={()=>removeEmployee(item.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded"
                  >
                    Hapus
                  </button>


                </div>


              </td>


            </tr>

          ))}



          {employees.length===0 && (

            <tr>

              <td
                colSpan={4}
                className="border p-4 text-center"
              >
                Belum ada data
              </td>

            </tr>

          )}


          </tbody>


        </table>


      </div>


    </div>

  );

}