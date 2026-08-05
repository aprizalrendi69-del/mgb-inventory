"use client";


import { useEffect,useState } from "react";


export default function StockCardPage(){


  const [barang,setBarang] =
  useState<any[]>([]);


  const [selected,setSelected] =
  useState("");


  const [data,setData] =
  useState<any>(null);



  const [loading,setLoading] =
  useState(false);





  async function loadBarang(){


    try{


      const res =
      await fetch("/api/barang");



      const json =
      await res.json();



      setBarang(

        Array.isArray(json)
        ?
        json
        :
        json.data || []

      );


    }catch(error){

      console.error(error);

    }


  }






  async function loadCard(){


    if(!selected)
    return;



    try{


      setLoading(true);



      const res =
      await fetch(
        `/api/stock-card/${selected}`,
        {
          cache:"no-store"
        }
      );



      const json =
      await res.json();



      if(json.success){

        setData(json.data);

      }else{

        alert(json.message);

      }



    }catch(error){

      console.error(error);

    }


    setLoading(false);


  }





  useEffect(()=>{


    loadBarang();


  },[]);






  return (


    <div className="p-8">


      <h1 className="
      text-3xl
      font-bold
      mb-6
      ">

        Kartu Stok

      </h1>





      <div className="
      bg-white
      shadow
      rounded-xl
      p-5
      mb-6
      ">


        <select

        className="
        border
        p-3
        rounded
        w-full
        "

        value={selected}

        onChange={
          e=>setSelected(e.target.value)
        }

        >


          <option value="">

            -- Pilih Barang --

          </option>



          {
            barang.map(
              (b:any)=>(


                <option

                key={b.id}

                value={b.id}

                >

                  {b.code} - {b.name}

                </option>


              )
            )
          }


        </select>




        <button

        onClick={loadCard}

        className="
        mt-4
        bg-blue-600
        text-white
        px-6
        py-2
        rounded
        "

        >

          {
            loading
            ?
            "Loading..."
            :
            "Tampilkan"
          }


        </button>


      </div>








      {
        data && (


        <div className="
        bg-white
        shadow
        rounded-xl
        overflow-hidden
        ">



          <div className="p-5">


            <h2 className="
            text-xl
            font-bold
            ">

              {data.barang?.name}

            </h2>



            <p>

              Stock Sekarang :

              <b>

                {" "}
                {data.barang?.stock}

              </b>

            </p>



          </div>







          <table className="
          w-full
          border
          ">


            <thead className="bg-gray-100">


              <tr>


                <th className="border p-3">
                  Tanggal
                </th>


                <th className="border p-3">
                  Transaksi
                </th>


                <th className="border p-3">
                  Qty Masuk
                </th>


                <th className="border p-3">
                  Qty Keluar
                </th>


                <th className="border p-3">
                  Balance
                </th>


                <th className="border p-3">
                  Keterangan
                </th>


              </tr>


            </thead>






            <tbody>



            {

              data.stockCard?.length === 0

              ?

              (

                <tr>

                  <td
                  colSpan={6}
                  className="p-5 text-center"
                  >

                    Belum ada transaksi

                  </td>

                </tr>

              )

              :

              data.stockCard?.map(
                (item:any)=>(


                <tr key={item.id}>


                  <td className="border p-3">


                    {
                      new Date(
                        item.trxDate
                      )
                      .toLocaleDateString(
                        "id-ID"
                      )
                    }


                  </td>



                  <td className="border p-3">

                    {item.trxType}

                  </td>




                  <td className="border p-3 text-center">

                    {item.qtyIn}

                  </td>




                  <td className="border p-3 text-center">

                    {item.qtyOut}

                  </td>




                  <td className="border p-3 text-center">

                    {item.balance}

                  </td>




                  <td className="border p-3">

                    {item.note}

                  </td>



                </tr>


              ))

            }



            </tbody>



          </table>




        </div>


        )
      }



    </div>


  );


}