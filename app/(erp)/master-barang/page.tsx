"use client";

import { useEffect, useState } from "react";
import {
  Package,
  Upload,
  Plus,
  Search,
} from "lucide-react";

import BarangForm from "@/components/master/barang/BarangForm";
import BarangTable from "@/components/master/barang/BarangTable";
import SearchBar from "@/components/master/barang/SearchBar";
import ImportBarangModal from "@/components/master/barang/ImportBarangModal";


export default function BarangPage() {


  const [barang,setBarang] =
    useState<any[]>([]);


  const [search,setSearch] =
    useState("");


  const [openImport,setOpenImport] =
    useState(false);



  async function loadBarang(){


    try{


      const res =
        await fetch(
          `/api/master/barang?search=${search}`,
          {
            cache:"no-store"
          }
        );


      const json =
        await res.json();


      if(json.success){

        setBarang(json.data);

      }


    }catch(error){

      console.error(
        "Load barang error",
        error
      );

    }


  }



  useEffect(()=>{

    loadBarang();

  },[search]);





  return (

    <div
      className="
        min-h-screen
        bg-[#F8FBF9]
        p-6
        md:p-8
      "
    >


      {/* HEADER */}

      <div
        className="
          mb-6
          flex
          flex-col
          gap-4
          md:flex-row
          md:items-center
          md:justify-between
        "
      >


        <div>


          <div
            className="
              flex
              items-center
              gap-3
            "
          >

            <div
              className="
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-2xl
                bg-[#E8F3EC]
              "
            >

              <Package
                size={24}
                className="text-[#497F70]"
              />

            </div>


            <div>

              <h1
                className="
                  text-2xl
                  font-bold
                  text-[#29483A]
                "
              >
                Master Barang
              </h1>


              <p
                className="
                  text-sm
                  text-[#71827A]
                "
              >
                Kelola data barang inventory perusahaan
              </p>

            </div>


          </div>


        </div>



        <button

          onClick={()=>setOpenImport(true)}

          className="
            flex
            items-center
            justify-center
            gap-2
            rounded-xl
            bg-[#497F70]
            px-5
            py-3
            text-sm
            font-semibold
            text-white
            shadow-sm
            transition
            hover:bg-[#3E6E61]
          "

        >

          <Upload size={18}/>

          Import Excel

        </button>



      </div>





      {/* FORM TAMBAH BARANG */}


      <div
        className="
          rounded-2xl
          border
          border-[#D5E5DC]
          bg-[#F9FCFA]
          p-6
          shadow-[0_4px_20px_rgba(73,127,112,0.05)]
        "
      >

        <div
          className="
            mb-5
            flex
            items-center
            gap-2
          "
        >

          <Plus
            size={18}
            className="text-[#497F70]"
          />

          <h2
            className="
              font-semibold
              text-[#29483A]
            "
          >
            Tambah Barang
          </h2>

        </div>


        <BarangForm/>


      </div>







      {/* SEARCH + TABLE */}


      <div
        className="
          mt-6
          rounded-2xl
          border
          border-[#D5E5DC]
          bg-[#F9FCFA]
          p-6
          shadow-[0_4px_20px_rgba(73,127,112,0.05)]
        "
      >



        <div
          className="
            mb-5
            flex
            items-center
            gap-2
          "
        >

          <Search
            size={18}
            className="text-[#497F70]"
          />


          <h2
            className="
              font-semibold
              text-[#29483A]
            "
          >
            Daftar Barang
          </h2>


        </div>




        <SearchBar

          search={search}

          setSearch={setSearch}

        />



        <div
          className="
            mt-5
            overflow-hidden
            rounded-xl
            border
            border-[#E2ECE6]
          "
        >

          <BarangTable

            data={barang}

            reload={loadBarang}

          />

        </div>




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