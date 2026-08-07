"use client";

import { useState } from "react";
import Link from "next/link";

export default function BarangTable({
  data,
  reload,
}: {
  data: any[];
  reload: () => void;
}) {

  const [selected, setSelected] = useState<number[]>([]);


  function toggle(id:number){

    setSelected((old)=>
      old.includes(id)
        ? old.filter(x => x !== id)
        : [...old, id]
    );

  }



  function toggleAll(){

    if(selected.length === data.length){

      setSelected([]);

    }else{

      setSelected(
        data.map(item => item.id)
      );

    }

  }



  function cetakBarcode(){

    if(selected.length === 0){

      alert("Pilih minimal satu barang");
      return;

    }


    const ids = selected.join(",");


    window.open(
      `/master-barang/barcode?ids=${ids}`,
      "_blank"
    );

  }





  async function hapus(id:number){

    const ok = confirm(
      "Hapus barang ini?"
    );


    if(!ok) return;



    try{

      const res = await fetch(
        `/api/master/barang/${id}`,
        {
          method:"DELETE"
        }
      );


      const json = await res.json();



      if(json.success){

        reload();

      }else{

        alert(
          json.message || "Gagal menghapus barang"
        );

      }


    }catch(error){

      console.error(error);

      alert(
        "Gagal menghapus barang"
      );

    }

  }





  return (

    <>


      <div className="
        flex
        justify-between
        items-center
        mb-4
      ">


        <div className="text-sm text-gray-600">

          Total Barang :

          <b className="ml-1">
            {data.length}
          </b>

        </div>



        <button

          onClick={cetakBarcode}

          disabled={selected.length === 0}

          className={`
            px-4
            py-2
            rounded-lg
            text-white

            ${
              selected.length === 0

              ?

              "bg-gray-400 cursor-not-allowed"

              :

              "bg-blue-600 hover:bg-blue-700"
            }

          `}

        >

          🏷 Cetak Barcode ({selected.length})

        </button>


      </div>





      <table className="w-full border mt-5">


        <thead className="bg-slate-100">

          <tr>


            <th className="border p-2">

              <input

                type="checkbox"

                checked={
                  data.length > 0 &&
                  selected.length === data.length
                }

                onChange={toggleAll}

              />

            </th>


            <th className="border p-2">
              Kode
            </th>


            <th className="border p-2">
              Barcode
            </th>


            <th className="border p-2">
              Nama
            </th>


            <th className="border p-2">
              Kategori
            </th>


            <th className="border p-2">
              Satuan
            </th>


            <th className="border p-2">
              Stock
            </th>


            <th className="border p-2">
              Harga Beli
            </th>


            <th className="border p-2">
              Harga Jual
            </th>


            <th className="border p-2">
              Aksi
            </th>


          </tr>


        </thead>





        <tbody>


        {
          data.length === 0 && (

            <tr>

              <td
                colSpan={10}
                className="
                  border
                  p-6
                  text-center
                  text-gray-500
                "
              >

                Tidak ada data barang

              </td>

            </tr>

          )
        }






        {
          data.map((item)=>(


            <tr

              key={item.id}

              className={
                selected.includes(item.id)
                ? "bg-blue-50"
                : ""
              }

            >



              <td className="
                border
                p-2
                text-center
              ">


                <input

                  type="checkbox"

                  checked={
                    selected.includes(item.id)
                  }

                  onChange={() =>
                    toggle(item.id)
                  }

                />


              </td>






              <td className="border p-2">

                {item.code}

              </td>





              <td className="border p-2">

                {item.barcode || "-"}

              </td>





              <td className="border p-2">

                {item.name}

              </td>





              <td className="border p-2">

                {
                  typeof item.category === "object"

                  ?

                  item.category?.name

                  :

                  item.category || "-"
                }

              </td>





              <td className="border p-2">

                {
                  typeof item.unit === "object"

                  ?

                  item.unit?.name

                  :

                  item.unit || "-"
                }

              </td>






              <td className="border p-2 text-center">

                {item.stock ?? 0}

              </td>






              <td className="border p-2">

                {Number(
                  item.purchasePrice ?? 0
                ).toLocaleString("id-ID")}

              </td>






              <td className="border p-2">

                {Number(
                  item.sellingPrice ?? 0
                ).toLocaleString("id-ID")}

              </td>







              <td className="border p-2">


                <div className="
                  flex
                  gap-2
                  flex-wrap
                ">





                  <button

                    onClick={()=>{

                      window.open(
                        `/master-barang/barcode?ids=${item.id}`,
                        "_blank"
                      );

                    }}

                    className="
                      bg-green-600
                      hover:bg-green-700
                      text-white
                      px-3
                      py-1
                      rounded
                    "

                  >

                    Barcode

                  </button>







                  <Link
  href={`/master-barang/${item.id}/edit?test=123`}
  className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
>
  EDIT
</Link>







                  <button

                    onClick={() =>
                      hapus(item.id)
                    }

                    className="
                      bg-red-600
                      hover:bg-red-700
                      text-white
                      px-3
                      py-1
                      rounded
                    "

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


    </>

  );


}