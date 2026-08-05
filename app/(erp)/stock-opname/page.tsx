"use client";

import { useEffect, useState } from "react";
import Link from "next/link";


export default function StockOpnamePage(){


  const [data,setData] =
    useState<any[]>([]);


  const [loading,setLoading] =
    useState(true);



  async function loadData(){

    try{

      const res =
        await fetch(
          "/api/stock-opname",
          {
            cache:"no-store"
          }
        );


      const json =
        await res.json();


      console.log(
        "STOCK OPNAME LIST:",
        json
      );


      if(json.success){

        setData(
          json.data ?? []
        );

      }else{

        setData([]);

      }



    }catch(error){

      console.error(
        "LOAD STOCK OPNAME ERROR",
        error
      );

      setData([]);

    }


    setLoading(false);

  }







  useEffect(()=>{

    loadData();

  },[]);







  async function buatOpname(){


    const ok =
      confirm(
        "Buat Stock Opname baru?"
      );


    if(!ok) return;




    try{


      const res =
        await fetch(
          "/api/stock-opname",
          {
            method:"POST"
          }
        );



      const json =
        await res.json();



      console.log(
        "CREATE STOCK OPNAME:",
        json
      );




      if(json.success){


        alert(
          "Stock Opname berhasil dibuat"
        );


        loadData();


      }else{


        alert(
          json.message
        );


      }



    }catch(error){

      console.error(error);

      alert(
        "Gagal membuat Stock Opname"
      );

    }



  }






  return (

    <div className="p-6">


      <div className="flex justify-between mb-5">


        <div>

          <h1 className="text-2xl font-bold">
            Stock Opname
          </h1>


          <p className="text-gray-500">
            Pemeriksaan stok fisik gudang
          </p>


        </div>




        <button

          onClick={buatOpname}

          className="
          bg-blue-600
          text-white
          px-4
          py-2
          rounded
          "

        >

          + Buat Opname

        </button>


      </div>







      <div className="bg-white rounded shadow overflow-hidden">


        <table className="w-full">


          <thead>


            <tr className="bg-gray-100">


              <th className="p-3 border">
                No
              </th>


              <th className="p-3 border">
                Kode
              </th>


              <th className="p-3 border">
                Tanggal
              </th>


              <th className="p-3 border">
                Status
              </th>


              <th className="p-3 border">
                Jumlah Item
              </th>


              <th className="p-3 border">
                Aksi
              </th>


            </tr>


          </thead>





          <tbody>


          {

          loading ?


          <tr>

            <td
              colSpan={6}
              className="p-5 text-center"
            >

              Loading...

            </td>


          </tr>



          :



          data.length===0 ?



          <tr>

            <td
              colSpan={6}
              className="p-5 text-center"
            >

              Belum ada Stock Opname

            </td>


          </tr>



          :



          data.map(
            (item,index)=>(


            <tr
              key={item.id}
            >


              <td className="border p-3 text-center">

                {index+1}

              </td>



              <td className="border p-3">

                {item.code}

              </td>




              <td className="border p-3">


                {
                  item.date
                  ?
                  new Date(
                    item.date
                  )
                  .toLocaleDateString(
                    "id-ID"
                  )
                  :
                  "-"
                }


              </td>





              <td className="border p-3 text-center">


                <span

                className={`
                px-3 py-1 rounded text-sm

                ${
                  item.status==="APPROVED"

                  ?

                  "bg-green-100 text-green-700"

                  :

                  "bg-yellow-100 text-yellow-700"

                }

                `}

                >

                  {item.status}

                </span>


              </td>





              <td className="border p-3 text-center">

                {item.totalItem ?? 0}

              </td>






              <td className="border p-3 text-center">


                <Link

                href={`/stock-opname/${item.id}`}

                className="
                bg-blue-600
                text-white
                px-3
                py-1
                rounded
                "

                >

                  Detail

                </Link>


              </td>



            </tr>


          ))



          }


          </tbody>


        </table>


      </div>


    </div>

  );


}