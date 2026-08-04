"use client";

import { useEffect, useState } from "react";

import BarangForm from "@/components/master/barang/BarangForm";
import BarangTable from "@/components/master/barang/BarangTable";
import SearchBar from "@/components/master/barang/SearchBar";
import ImportBarangModal from "@/components/master/barang/ImportBarangModal";


export default function BarangPage() {

  const [barang, setBarang] =
    useState<any[]>([]);


  const [search, setSearch] =
    useState("");


  const [openImport, setOpenImport] =
    useState(false);



  async function loadBarang(){

    const res =
      await fetch(
        `/api/master/barang?search=${search}`
      );


    const json =
      await res.json();


    if(json.success){

      setBarang(json.data);

    }

  }



  useEffect(()=>{

    loadBarang();

  },[search]);



  return (

    <div className="p-8">


      <div className="
        flex
        justify-between
        items-center
        mb-6
      ">


        <h1 className="
          text-3xl
          font-bold
        ">

          Master Barang

        </h1>



        <button

          onClick={()=>
            setOpenImport(true)
          }

          className="
            bg-green-600
            text-white
            px-5
            py-2
            rounded-lg
          "

        >

          Import Excel

        </button>


      </div>



      <BarangForm />
            <div className="mt-8">

        <SearchBar

          search={search}

          setSearch={setSearch}

        />

      </div>





      <BarangTable

        data={barang}

        reload={loadBarang}

      />





      <ImportBarangModal

        open={openImport}

        onClose={()=>
          setOpenImport(false)
        }

        reload={loadBarang}

      />



    </div>

  );

}