"use client";

import { useState } from "react";


export default function BarangForm({
  reload
}:{
  reload?:()=>void;
}) {


  const initialForm = {

    code:"",
    barcode:"",
    name:"",
    category:"",
    unit:"",
    hasExpired:false,

  };


  const [form,setForm] = useState(initialForm);


  const [loading,setLoading] = useState(false);



  async function simpan(){


    if(!form.code || !form.name){

      alert(
        "Kode Barang dan Nama Barang wajib diisi"
      );

      return;

    }



    try{


      setLoading(true);



      const res = await fetch(
        "/api/barang",
        {

          method:"POST",

          headers:{
            "Content-Type":"application/json",
          },

          body:JSON.stringify(form),

        }
      );



      const json = await res.json();



      if(json.success){


        alert(
          "Barang berhasil disimpan"
        );


        setForm(initialForm);



        if(reload){

          reload();

        }



      }else{


        alert(
          json.message ||
          "Gagal menyimpan barang"
        );


      }



    }catch(error){


      console.error(error);


      alert(
        "Terjadi kesalahan server"
      );


    }finally{


      setLoading(false);


    }


  }




  return (

    <div className="
      bg-white
      rounded-xl
      shadow
      p-6
    ">


      <h2 className="
        text-xl
        font-bold
        mb-5
      ">
        Tambah Master Barang
      </h2>



      <div className="
        grid
        grid-cols-2
        gap-4
      ">


        <input
          className="border rounded-lg p-2"
          placeholder="Kode Barang"
          value={form.code}
          onChange={(e)=>
            setForm({
              ...form,
              code:e.target.value
            })
          }
        />


        <input
          className="border rounded-lg p-2"
          placeholder="Barcode"
          value={form.barcode}
          onChange={(e)=>
            setForm({
              ...form,
              barcode:e.target.value
            })
          }
        />


        <input
          className="border rounded-lg p-2"
          placeholder="Nama Barang"
          value={form.name}
          onChange={(e)=>
            setForm({
              ...form,
              name:e.target.value
            })
          }
        />


        <input
          className="border rounded-lg p-2"
          placeholder="Kategori"
          value={form.category}
          onChange={(e)=>
            setForm({
              ...form,
              category:e.target.value
            })
          }
        />


        <input
          className="border rounded-lg p-2"
          placeholder="Satuan"
          value={form.unit}
          onChange={(e)=>
            setForm({
              ...form,
              unit:e.target.value
            })
          }
        />



        <label className="
          flex
          items-center
          gap-2
          col-span-2
        ">

          <input

            type="checkbox"

            checked={form.hasExpired}

            onChange={(e)=>
              setForm({
                ...form,
                hasExpired:e.target.checked
              })
            }

          />


          Barang memiliki tanggal expired


        </label>



        <button

          disabled={loading}

          onClick={simpan}

          className="
            bg-blue-600
            text-white
            rounded-lg
            py-2
            col-span-2
            hover:bg-blue-700
          "

        >

          {
            loading
            ?
            "Menyimpan..."
            :
            "Simpan Barang"
          }


        </button>



      </div>


    </div>

  );

}