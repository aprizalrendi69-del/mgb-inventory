"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EditBarangPage() {

  const params = useParams();
  const router = useRouter();

  const id = params.id;


  const [loading,setLoading] = useState(true);


  const [form,setForm] = useState({

    code:"",
    barcode:"",
    name:"",
    category:"",
    unit:"",
    minimumStock:0,
    purchasePrice:0,
    sellingPrice:0,
    hasExpired:false,

  });



  async function loadData(){

    try{

      const res =
      await fetch(
        `/api/master/barang/${id}`,
        {
          cache:"no-store"
        }
      );


      const json =
      await res.json();


      if(json.success){

        const b = json.data;


        setForm({

          code:b.code ?? "",
          barcode:b.barcode ?? "",
          name:b.name ?? "",
          category:b.category ?? "",
          unit:b.unit ?? "",
          minimumStock:b.minimumStock ?? 0,
          purchasePrice:b.purchasePrice ?? 0,
          sellingPrice:b.sellingPrice ?? 0,
          hasExpired:b.hasExpired ?? false,

        });

      }


    }catch(error){

      console.error(error);

    }finally{

      setLoading(false);

    }

  }




  useEffect(()=>{

    if(id){

      loadData();

    }

  },[id]);





  function update(
    field:string,
    value:any
  ){

    setForm({

      ...form,

      [field]:value

    });

  }





  async function save(){


    const res =
    await fetch(
      `/api/master/barang/${id}`,
      {

        method:"PUT",

        headers:{
          "Content-Type":"application/json"
        },

        body:JSON.stringify(form)

      }
    );


    const json =
    await res.json();


    if(json.success){

      alert(
        "Barang berhasil diupdate"
      );


      router.push(
        "/master-barang"
      );


    }else{

      alert(
        json.message
      );

    }


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


      <h1 className="text-3xl font-bold mb-6">

        Edit Barang

      </h1>



      <div className="bg-white shadow rounded p-6 space-y-4">



        <input

          className="border p-2 w-full"

          value={form.code}

          disabled

          placeholder="Kode Barang"

        />



        <input

          className="border p-2 w-full"

          value={form.barcode}

          onChange={(e)=>
            update(
              "barcode",
              e.target.value
            )
          }

          placeholder="Barcode"

        />



        <input

          className="border p-2 w-full"

          value={form.name}

          onChange={(e)=>
            update(
              "name",
              e.target.value
            )
          }

          placeholder="Nama Barang"

        />



        <input

          className="border p-2 w-full"

          value={form.category}

          onChange={(e)=>
            update(
              "category",
              e.target.value
            )
          }

          placeholder="Kategori"

        />



        <input

          className="border p-2 w-full"

          value={form.unit}

          onChange={(e)=>
            update(
              "unit",
              e.target.value
            )
          }

          placeholder="Satuan"

        />



        <input

          type="number"

          className="border p-2 w-full"

          value={form.minimumStock}

          onChange={(e)=>
            update(
              "minimumStock",
              Number(e.target.value)
            )
          }

          placeholder="Minimum Stock"

        />



        <input

          type="number"

          className="border p-2 w-full"

          value={form.purchasePrice}

          onChange={(e)=>
            update(
              "purchasePrice",
              Number(e.target.value)
            )
          }

          placeholder="Harga Beli"

        />



        <input

          type="number"

          className="border p-2 w-full"

          value={form.sellingPrice}

          onChange={(e)=>
            update(
              "sellingPrice",
              Number(e.target.value)
            )
          }

          placeholder="Harga Jual"

        />




        <label className="flex gap-2 items-center">

          <input

            type="checkbox"

            checked={form.hasExpired}

            onChange={(e)=>
              update(
                "hasExpired",
                e.target.checked
              )
            }

          />

          Barang memiliki expired

        </label>




        <div className="flex gap-3">


          <button

            onClick={save}

            className="
            bg-blue-600
            text-white
            px-5
            py-2
            rounded
            "

          >

            Simpan

          </button>



          <button

            onClick={()=>
              router.push("/master-barang")
            }

            className="
            bg-gray-500
            text-white
            px-5
            py-2
            rounded
            "

          >

            Kembali

          </button>


        </div>



      </div>



    </div>

  );

}