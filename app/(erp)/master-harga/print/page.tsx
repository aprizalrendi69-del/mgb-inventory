"use client";

import { useEffect, useState } from "react";


export default function PrintMasterHarga(){

  const [data,setData] =
  useState<any[]>([]);


  const [loading,setLoading] =
  useState(true);



  async function loadData(){

    const res =
    await fetch("/api/master-harga");


    const json =
    await res.json();


    if(json.success){

      setData(json.data);

    }


    setLoading(false);

  }



  useEffect(()=>{

    loadData();

  },[]);



  function printPage(){

    window.print();

  }



  if(loading){

    return (
      <div className="p-8">
        Loading...
      </div>
    );

  }



  return (

    <div className="p-8">


      <div className="flex justify-between mb-5 print:hidden">

        <h1 className="text-2xl font-bold">
          Print Master Harga
        </h1>


        <button

          onClick={printPage}

          className="bg-blue-600 text-white px-5 py-2 rounded"

        >
          Print

        </button>


      </div>



      <h2 className="text-center text-xl font-bold mb-5">

        LAPORAN MASTER HARGA

      </h2>



      <table className="w-full border-collapse border">


        <thead>

          <tr className="bg-gray-100">


            <th className="border p-2">
              Kode
            </th>


            <th className="border p-2">
              Barang
            </th>


            <th className="border p-2">
              Supplier
            </th>


            <th className="border p-2">
              Harga Lama
            </th>


            <th className="border p-2">
              Harga Baru
            </th>


            <th className="border p-2">
              Selisih
            </th>


            <th className="border p-2">
              %
            </th>


          </tr>

        </thead>



        <tbody>


        {
          data.map((item)=>(

            <tr key={item.id}>


              <td className="border p-2">

                {item.barang.code}

              </td>


              <td className="border p-2">

                {item.barang.name}

              </td>


              <td className="border p-2">

                {item.supplier.name}

              </td>


              <td className="border p-2 text-right">

                Rp {item.hargaLama.toLocaleString("id-ID")}

              </td>


              <td className="border p-2 text-right">

                Rp {item.hargaBaru.toLocaleString("id-ID")}

              </td>


              <td className="border p-2 text-right">

                Rp {item.selisihHarga.toLocaleString("id-ID")}

              </td>


              <td className="border p-2 text-right">

                {item.persenNaik.toFixed(2)}%

              </td>


            </tr>

          ))
        }


        </tbody>


      </table>


    </div>

  );

}