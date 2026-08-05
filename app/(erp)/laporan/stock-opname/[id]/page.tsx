"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";


export default function DetailLaporanStockOpname(){

  const params = useParams();

  const id = params.id;


  const [data,setData] = useState<any>(null);

  const [loading,setLoading] = useState(true);



  async function loadData(){

    try{

      const res =
        await fetch(
          `/api/stock-opname/${id}`,
          {
            cache:"no-store"
          }
        );


      const json =
        await res.json();


      if(json.success){

        setData(json.data);

      }


    }catch(error){

      console.error(error);

    }


    setLoading(false);

  }





  useEffect(()=>{

    loadData();

  },[]);





  if(loading){

    return (
      <div className="p-6">
        Loading...
      </div>
    );

  }





  if(!data){

    return(
      <div className="p-6">
        Data tidak ditemukan
      </div>
    );

  }





  return (

    <div className="p-6">


      <div className="mb-5">


        <h1 className="text-2xl font-bold">

          Detail Stock Opname {data.code}

        </h1>


        <p>

          Status : {data.status}

        </p>


        <p>

          Tanggal :
          {" "}
          {
            new Date(data.date)
            .toLocaleDateString("id-ID")
          }

        </p>


      </div>






      <div className="bg-white shadow rounded">


      <table className="w-full">


      <thead>

      <tr className="bg-gray-100">


        <th className="border p-3">
          No
        </th>


        <th className="border p-3">
          Barang
        </th>


        <th className="border p-3">
          System Qty
        </th>


        <th className="border p-3">
          Fisik
        </th>


        <th className="border p-3">
          Selisih
        </th>


      </tr>


      </thead>



      <tbody>


      {

      data.items.map(
        (item:any,index:number)=>(


        <tr key={item.id}>


          <td className="border p-3 text-center">

            {index+1}

          </td>



          <td className="border p-3">

            {item.barang?.name}

          </td>



          <td className="border p-3 text-center">

            {item.systemQty}

          </td>



          <td className="border p-3 text-center">

            {item.physicalQty}

          </td>



          <td
          className={`border p-3 text-center ${
            
            item.difference !== 0
            ?
            "text-red-600 font-bold"
            :
            ""

          }`}
          >

            {item.difference}


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