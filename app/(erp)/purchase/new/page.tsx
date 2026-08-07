"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";


export default function NewPurchasePage() {

  const router = useRouter();


  const [supplier, setSupplier] =
  useState<any[]>([]);


  const [barang, setBarang] =
  useState<any[]>([]);


  const [priceWarning, setPriceWarning] =
  useState<any>({});



  const [form, setForm] =
  useState({

    supplierId:"",

    purchaseDate:
    new Date()
    .toISOString()
    .substring(0,10),


    items:[

      {

        barangId:"",

        qty:1,

        price:0,

      }

    ]

  });





  useEffect(()=>{

    loadSupplier();

    loadBarang();

  },[]);






  async function loadSupplier(){

    const res =
    await fetch("/api/supplier");


    const json =
    await res.json();


    if(json.success){

      setSupplier(
        json.data
      );

    }

  }





  async function loadBarang(){

    const res =
    await fetch("/api/barang");


    const json =
    await res.json();


    if(json.success){

      setBarang(
        json.data
      );

    }

  }






  function addItem(){


    setForm({

      ...form,


      items:[

        ...form.items,


        {

          barangId:"",

          qty:1,

          price:0

        }

      ]

    });


  }







  function removeItem(index:number){


    const arr =
    [...form.items];


    arr.splice(
      index,
      1
    );


    setForm({

      ...form,

      items:arr

    });


  }







  function updateItem(
    index:number,
    field:string,
    value:any
  ){


    const arr =
    [...form.items];


    arr[index] = {

      ...arr[index],

      [field]:
      value

    };



    setForm({

      ...form,

      items:arr

    });


  }






  async function loadLastPrice(
    index:number,
    barangId:string
  ){


    if(!barangId){

      return;

    }



    try{


      const res =
      await fetch(
        `/api/master-harga/latest/${barangId}`
      );



      const json =
      await res.json();




      if(
        json.success &&
        json.data
      ){


        const arr =
        [...form.items];



        arr[index] = {


          ...arr[index],


          barangId,


          price:
          json.data.hargaTerakhir


        };



        setForm({

          ...form,

          items:arr

        });


      }



    }catch(error){

      console.log(error);

    }


  }






  async function checkPrice(
    index:number,
    barangId:string,
    harga:number
  ){


    if(
      !barangId ||
      harga<=0
    ){

      return;

    }




    try{


      const res =
      await fetch(
        `/api/master-harga/check/${barangId}/${harga}`
      );



      const json =
      await res.json();




      if(
        json.success &&
        json.data
      ){


        setPriceWarning(
          (prev:any)=>({

            ...prev,

            [index]:
            json.data

          })
        );


      }



    }catch(error){

      console.log(error);

    }


  }
    async function savePurchase(){

    const res =
    await fetch(
      "/api/purchase",
      {

        method:"POST",

        headers:{
          "Content-Type":"application/json"
        },

        body:
        JSON.stringify(form)

      }
    );


    const json =
    await res.json();



    if(json.success){

      alert(
        "Purchase berhasil dibuat"
      );


      router.push(
        "/purchase"
      );


    }else{


      alert(
        json.message
      );


    }

  }






  return (

    <div className="p-8">


      <h1 className="text-3xl font-bold mb-6">

        Purchase Order Baru

      </h1>





      <div className="
      bg-white
      rounded
      shadow
      p-6
      space-y-5
      ">





        <div>


          <label className="block mb-2">

            Supplier

          </label>




          <select

          className="
          border
          rounded
          w-full
          p-2
          "


          value={
            form.supplierId
          }


          onChange={(e)=>

            setForm({

              ...form,

              supplierId:
              e.target.value

            })

          }


          >


            <option value="">

              Pilih Supplier

            </option>



            {
              supplier.map(
                (item)=>(


                <option

                key={item.id}

                value={item.id}

                >

                  {item.name}

                </option>


                )
              )
            }


          </select>



        </div>








        <div>


          <label className="block mb-2">

            Tanggal PO

          </label>




          <input

          type="date"

          className="
          border
          rounded
          w-full
          p-2
          "


          value={
            form.purchaseDate
          }



          onChange={(e)=>

            setForm({

              ...form,

              purchaseDate:
              e.target.value

            })

          }



          />



        </div>






        <hr />





        <h2 className="font-bold text-lg">

          Detail Barang

        </h2>








        {
        form.items.map(
          (row,index)=>(



          <div

          key={index}

          className="
          grid
          grid-cols-4
          gap-4
          mb-3
          "


          >





            <select

            className="
            border
            rounded
            p-2
            "



            value={
              row.barangId
            }




            onChange={(e) => {

  const barangId = e.target.value;

  updateItem(
    index,
    "barangId",
    barangId
  );

  loadLastPrice(
    index,
    barangId
  );

}}



            >



              <option value="">

                Barang

              </option>





              {
              barang.map(
                (b)=>(


                <option

                key={b.id}

                value={b.id}

                >

                  {b.name}

                </option>


                )
              )
              }




            </select>









            <input


            type="number"


            className="
            border
            rounded
            p-2
            "


            placeholder="Qty"




            value={
              row.qty
            }




            onChange={(e)=>

              updateItem(

                index,

                "qty",

                Number(
                  e.target.value
                )

              )

            }




            />









            <input


            type="number"


            className="
            border
            rounded
            p-2
            "


            placeholder="Harga terakhir"



            value={
              row.price
            }




            onChange={(e)=>{


              const value =
              Number(
                e.target.value
              );



              updateItem(

                index,

                "price",

                value

              );



              checkPrice(

                index,

                row.barangId,

                value

              );



            }}




            />








            <button


            onClick={()=>


              removeItem(index)


            }


            className="
            bg-red-600
            text-white
            rounded
            "


            >


              Hapus


            </button>






            {
            priceWarning[index] && (


            <div

            className="
            col-span-4
            bg-yellow-100
            text-yellow-800
            p-3
            rounded
            "

            >



              ⚠ Harga berubah dari{" "}



              Rp{" "}

              {
              priceWarning[index]
              .hargaLama
              .toLocaleString("id-ID")
              }



              {" "}menjadi{" "}



              Rp{" "}

              {
              priceWarning[index]
              .hargaBaru
              .toLocaleString("id-ID")
              }



              <br />



              Perubahan:

              {" "}

              {
              priceWarning[index]
              .persen
              ?.toFixed(2)
              ??
              0
              }%




              <br />



              Supplier terakhir:

              {" "}

              {
              priceWarning[index]
              .supplier
              }



            </div>


            )
            }





          </div>


          )

        )

        }








        <button


        onClick={addItem}


        className="
        bg-green-600
        text-white
        px-4
        py-2
        rounded
        "


        >


          + Tambah Barang


        </button>







        <hr />







        <button


        onClick={savePurchase}


        className="
        bg-blue-600
        text-white
        px-6
        py-3
        rounded
        "


        >


          Simpan Purchase Order


        </button>





      </div>


    </div>

  );


}
