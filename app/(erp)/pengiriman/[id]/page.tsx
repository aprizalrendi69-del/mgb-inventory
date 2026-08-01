"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";


export default function PengirimanDetail(){

  const params = useParams();

  const id = params.id as string;

  const [data,setData] = useState<any>(null);
  const [loading,setLoading] = useState(true);


  async function load(){

    try{

      const res = await fetch(
        `/api/pengiriman/${id}`,
        {
          cache:"no-store"
        }
      );

      const json = await res.json();

      console.log(json);

      setData(json.data);

    }catch(error){

      console.error(error);

    }finally{

      setLoading(false);

    }

  }



  useEffect(()=>{

    if(id){
      load();
    }

  },[id]);




  async function prosesKirim(){

    const yakin = confirm(
      "Proses pengiriman ini? Stock akan berkurang."
    );


    if(!yakin) return;



    try{

      const res = await fetch(
        `/api/pengiriman/${id}/release`,
        {
          method:"POST"
        }
      );


      const json = await res.json();


      alert(json.message);


      if(json.success){

        load();

      }


    }catch(error){

      console.error(error);

      alert("Gagal proses pengiriman");

    }

  }




  if(loading){

    return(
      <div className="p-8">
        Loading...
      </div>
    );

  }



  if(!data){

    return(
      <div className="p-8">
        Data pengiriman tidak ditemukan
      </div>
    );

  }





  return(

    <div className="p-8">


      <div className="flex justify-between items-center mb-6">


        <div>

          <h1 className="text-3xl font-bold">

            Delivery Order {data.number}

          </h1>


          <p className="mt-2">
            Customer : 
            <b className="ml-2">
              {data.customer?.name ?? "-"}
            </b>
          </p>


          <p>
            Tanggal :
            {" "}
            {new Date(
              data.deliveryDate
            ).toLocaleDateString("id-ID")}
          </p>


        </div>



        <button

          onClick={prosesKirim}

          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded"

        >
          Proses Kirim
        </button>



      </div>





      <div className="bg-white rounded shadow overflow-hidden">


        <table className="w-full border-collapse">


          <thead>

            <tr className="bg-gray-100">


              <th className="border p-3">
                Barang
              </th>


              <th className="border p-3">
                Qty
              </th>


              <th className="border p-3">
                Keterangan
              </th>


            </tr>


          </thead>



          <tbody>


            {
              data.items?.map((i:any)=>(


                <tr key={i.id}>


                  <td className="border p-3">

                    {i.barang?.name ?? "-"}

                  </td>



                  <td className="border p-3">

                    {i.qty}

                  </td>



                  <td className="border p-3">

                    {i.note ?? "-"}

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