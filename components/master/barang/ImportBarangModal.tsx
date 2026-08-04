"use client";

import { useState } from "react";


export default function ImportBarangModal({
  open,
  onClose,
  reload
}:{
  open:boolean;
  onClose:()=>void;
  reload:()=>void;
}){


  const [file,setFile] = useState<File|null>(null);

  const [loading,setLoading] = useState(false);



  if(!open) return null;



  async function handleImport(){


    if(!file){

      alert("Pilih file Excel terlebih dahulu");

      return;

    }



    const formData = new FormData();

    formData.append(
      "file",
      file
    );



    try{


      setLoading(true);



      const res = await fetch(
        "/api/master/barang/import",
        {
          method:"POST",
          body:formData
        }
      );



      const json = await res.json();



      if(json.success){


        alert(
          "Import barang berhasil"
        );


        reload();

        onClose();


      }else{


        alert(
          json.message || 
          "Import gagal"
        );


      }



    }catch(err){


      console.error(err);

      alert(
        "Terjadi kesalahan"
      );


    }finally{


      setLoading(false);


    }


  }




  return (

    <div className="
      fixed
      inset-0
      bg-black/40
      flex
      items-center
      justify-center
      z-50
    ">


      <div className="
        bg-white
        rounded-xl
        shadow-xl
        w-[450px]
        p-6
      ">


        <div className="
          flex
          justify-between
          items-center
          mb-5
        ">


          <h2 className="
            text-xl
            font-bold
          ">
            Import Master Barang
          </h2>



          <button

            onClick={onClose}

            className="
              text-gray-500
              hover:text-black
              text-xl
            "

          >
            ✕
          </button>


        </div>




        <div className="
          bg-gray-100
          rounded-lg
          p-4
          mb-5
          text-sm
        ">

          <b>Format Excel:</b>

          <br/>

          Kode Barang,
          Nama Barang,
          Kategori,
          Satuan


        </div>




        <input

          type="file"

          accept=".xlsx,.xls"

          onChange={(e)=>
            setFile(
              e.target.files?.[0] || null
            )
          }

          className="
            w-full
            border
            rounded-lg
            p-2
          "

        />



        {
          file &&

          <div className="
            mt-3
            text-sm
            text-gray-600
          ">

            File:
            <b>
              {" "}
              {file.name}
            </b>

          </div>

        }





        <div className="
          flex
          justify-end
          gap-3
          mt-6
        ">


          <button

            onClick={onClose}

            className="
              px-4
              py-2
              rounded-lg
              border
            "

          >

            Batal

          </button>




          <button

            onClick={handleImport}

            disabled={loading}

            className="
              bg-green-600
              text-white
              px-5
              py-2
              rounded-lg
              disabled:opacity-50
            "

          >

            {
              loading
              ?
              "Mengimport..."
              :
              "Import"
            }


          </button>


        </div>


      </div>


    </div>

  );

}