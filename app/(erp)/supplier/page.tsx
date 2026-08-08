"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Upload,
  Plus,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";

import ImportSupplierModal from "@/components/supplier/ImportSupplierModal";


export default function SupplierPage(){


  const [supplier,setSupplier] =
    useState<any[]>([]);

  const [loading,setLoading] =
    useState(true);

  const [openImport,setOpenImport] =
    useState(false);





  async function load(){


    try{


      setLoading(true);


      const res =
        await fetch(
          "/api/supplier",
          {
            cache:"no-store"
          }
        );


      const json =
        await res.json();


      if(json.success){

        setSupplier(json.data);

      }else{

        alert(json.message);

      }


    }catch(error){

      console.error(error);

      alert(
        "Gagal mengambil data supplier"
      );


    }finally{

      setLoading(false);

    }


  }






  async function hapusSupplier(id:number){


    const ok =
      confirm(
        "Yakin ingin menghapus supplier ini?"
      );


    if(!ok)return;



    try{


      const res =
        await fetch(
          `/api/supplier/${id}`,
          {
            method:"DELETE"
          }
        );


      const json =
        await res.json();


      alert(json.message);



      if(json.success){

        load();

      }



    }catch(error){

      console.error(error);

      alert(
        "Gagal menghapus supplier"
      );


    }


  }






  useEffect(()=>{

    load();

  },[]);







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

            <Building2
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
              Master Supplier
            </h1>


            <p
              className="
                text-sm
                text-[#71827A]
              "
            >
              Kelola data supplier perusahaan
            </p>


          </div>


        </div>





        <div
          className="
            flex
            gap-3
          "
        >



          <button

            onClick={()=>
              setOpenImport(true)
            }

            className="
              flex
              items-center
              gap-2
              rounded-xl
              bg-[#497F70]
              px-5
              py-3
              text-sm
              font-semibold
              text-white
              hover:bg-[#3E6E61]
            "

          >

            <Upload size={18}/>

            Import Excel

          </button>





          <Link

            href="/supplier/new"

            className="
              flex
              items-center
              gap-2
              rounded-xl
              bg-[#29483A]
              px-5
              py-3
              text-sm
              font-semibold
              text-white
              hover:bg-[#1F392F]
            "

          >

            <Plus size={18}/>

            Supplier

          </Link>


        </div>


      </div>







      {/* TABLE CARD */}



      <div
        className="
          overflow-hidden
          rounded-2xl
          border
          border-[#D5E5DC]
          bg-[#F9FCFA]
          shadow-[0_4px_20px_rgba(73,127,112,0.05)]
        "
      >



        <div
          className="
            flex
            items-center
            gap-2
            border-b
            border-[#E5EEE9]
            p-6
          "
        >

          <Users
            size={20}
            className="text-[#497F70]"
          />

          <div>

            <h2
              className="
                font-semibold
                text-[#29483A]
              "
            >
              Data Supplier
            </h2>


            <p
              className="
                text-xs
                text-[#71827A]
              "
            >
              Total {supplier.length} supplier
            </p>


          </div>


        </div>






        <div
          className="
            overflow-x-auto
          "
        >

        <table
          className="
            w-full
            border-collapse
          "
        >


          <thead>


            <tr
              className="
                bg-[#E8F3EC]
                text-[#29483A]
              "
            >

              <th className="p-3 text-left text-sm">
                Kode
              </th>


              <th className="p-3 text-left text-sm">
                Nama
              </th>


              <th className="p-3 text-left text-sm">
                Kota
              </th>


              <th className="p-3 text-left text-sm">
                Contact
              </th>


              <th className="p-3 text-left text-sm">
                Telepon
              </th>


              <th className="p-3 text-left text-sm">
                Email
              </th>


              <th className="p-3 text-center text-sm">
                Aksi
              </th>


            </tr>


          </thead>





          <tbody>


          {loading ? (

            <tr>

              <td
                colSpan={7}
                className="
                  p-8
                  text-center
                  text-[#71827A]
                "
              >

                Loading...

              </td>

            </tr>


          ) : supplier.length===0 ? (


            <tr>

              <td
                colSpan={7}
                className="
                  p-8
                  text-center
                  text-[#71827A]
                "
              >

                Belum ada data supplier

              </td>


            </tr>


          ) : (


            supplier.map((item:any)=>(


              <tr

                key={item.id}

                className="
                  border-t
                  border-[#E5EEE9]
                  hover:bg-[#F1F7F3]
                "

              >


                <td className="p-3 text-sm">
                  {item.code}
                </td>


                <td className="p-3 text-sm font-medium text-[#29483A]">
                  {item.name}
                </td>


                <td className="p-3 text-sm">
                  {item.city ?? "-"}
                </td>


                <td className="p-3 text-sm">
                  {item.contactPerson ?? "-"}
                </td>


                <td className="p-3 text-sm">
                  {item.phone ?? "-"}
                </td>


                <td className="p-3 text-sm">
                  {item.email ?? "-"}
                </td>



                <td className="p-3">


                  <div
                    className="
                      flex
                      justify-center
                      gap-2
                    "
                  >


                    <Link

                      href={`/supplier/${item.id}/edit`}

                      className="
                        flex
                        items-center
                        gap-1
                        rounded-lg
                        bg-[#F3EEDB]
                        px-3
                        py-2
                        text-xs
                        font-semibold
                        text-[#967C3E]
                      "

                    >

                      <Pencil size={14}/>

                      Edit

                    </Link>





                    <button

                      onClick={()=>
                        hapusSupplier(item.id)
                      }

                      className="
                        flex
                        items-center
                        gap-1
                        rounded-lg
                        bg-[#F7E0DC]
                        px-3
                        py-2
                        text-xs
                        font-semibold
                        text-[#A45447]
                      "

                    >

                      <Trash2 size={14}/>

                      Hapus

                    </button>



                  </div>


                </td>



              </tr>


            ))


          )}


          </tbody>



        </table>


        </div>



      </div>







      <ImportSupplierModal

        open={openImport}

        onClose={()=>
          setOpenImport(false)
        }

        onSuccess={load}

      />



    </div>


  );


}