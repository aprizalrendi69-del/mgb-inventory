"use client";

import { useEffect, useState } from "react";

import BarangForm from "@/components/master/barang/BarangForm";
import BarangTable from "@/components/master/barang/BarangTable";
import SearchBar from "@/components/master/barang/SearchBar";
import ImportBarangModal from "@/components/master/barang/ImportBarangModal";


export default function BarangPage() {


  const [barang,setBarang] = useState<any[]>([]);

  const [search,setSearch] = useState("");

  const [openImport,setOpenImport] = useState(false);

  const [loading,setLoading] = useState(false);



  async function loadBarang(){


    try{


      setLoading(true);



      const res = await fetch(
        `/api/master/barang?search=${encodeURIComponent(search)}`,
        {
          cache:"no-store"
        }
      );



      const json = await res.json();



      if(json.success){

        setBarang(json.data);

      }



    }catch(error){


      console.error(
        "Load barang error:",
        error
      );


    }finally{


      setLoading(false);


    }


  }




  useEffect(()=>{


    loadBarang();


  },[]);




  useEffect(()=>{


    const timer = setTimeout(()=>{

      loadBarang();

    },300);



    return ()=>clearTimeout(timer);



  },[search]);






  return (

    <div className="p-8">


      <div className="
        flex
        justify-between
        items-center
        mb-6
      ">


        <div>


          <h1 className="
            text-3xl
            font-bold
          ">

            Master Barang

          </h1>



          <p className="
            text-gray-500
            mt-1
          ">

            Kelola data barang, kategori, satuan dan expired

          </p>


        </div>





        <button

          onClick={()=>
            setOpenImport(true)
          }

          className="
            bg-green-600
            hover:bg-green-700
            text-white
            px-5
            py-2
            rounded-lg
          "

        >

          Import Excel


        </button>


      </div>






      <BarangForm

        reload={loadBarang}

      />







      <div className="mt-8">


        <SearchBar

          search={search}

          setSearch={setSearch}

        />


      </div>







      <div className="mt-5">


        {
          loading

          ?

          <div className="
            text-center
            py-10
            text-gray-500
          ">

            Loading data...

          </div>


          :


          <BarangTable

            data={barang}

            reload={loadBarang}

          />


        }


      </div>







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