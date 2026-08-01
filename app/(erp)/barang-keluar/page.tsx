"use client";

import { useEffect, useState } from "react";

export default function BarangKeluarPage() {

  const [barang, setBarang] = useState<any[]>([]);

  const [customers, setCustomers] = useState<any[]>([]);

  const [cart, setCart] = useState<any[]>([]);

  const [customer, setCustomer] = useState("");

  const [note, setNote] = useState("");

  const [selectedBarang, setSelectedBarang] = useState("");

  const [qty, setQty] = useState("");



  async function loadBarang(){

    try{

      const res = await fetch("/api/barang");

      const json = await res.json();

      setBarang(
        Array.isArray(json)
        ? json
        : json.data || []
      );

    }catch(error){

      console.error(error);

    }

  }

    async function loadCustomer() {
  try {
    const res = await fetch("/api/customer");
    const json = await res.json();

    setCustomers(
      Array.isArray(json)
        ? json
        : json.data || []
    );
  } catch (error) {
    console.error(error);
  }
}

  useEffect(() => {
  loadBarang();
  loadCustomer();
}, []);



  function tambahBarang(){


    if(!selectedBarang){

      alert("Pilih barang");

      return;

    }


    if(!qty || Number(qty)<=0){

      alert("Qty tidak valid");

      return;

    }



    const data =
      barang.find(
        (b)=>b.id === Number(selectedBarang)
      );



    if(!data){

      alert("Barang tidak ditemukan");

      return;

    }



    const cek =
      cart.find(
        (x)=>x.barangId === data.id
      );


    if(cek){

      alert("Barang sudah ada");

      return;

    }



    setCart([

      ...cart,

      {

        barangId:data.id,

        code:data.code,

        name:data.name,

        unit:data.unit,

        qty:Number(qty),

        price:Number(data.sellingPrice || 0),

        subtotal:
          Number(data.sellingPrice || 0)
          *
          Number(qty)

      }

    ]);



    setSelectedBarang("");

    setQty("");

  }




  function hapus(index:number){

    setCart(
      cart.filter(
        (_,i)=>i!==index
      )
    );

  }





  const totalQty =
    cart.reduce(
      (a,b)=>a+b.qty,
      0
    );


  const totalNominal =
    cart.reduce(
      (a,b)=>a+b.subtotal,
      0
    );





  async function simpan(){


    if(cart.length===0){

      alert("Belum ada barang");

      return;

    }



    try{


      const res =
      await fetch(
        "/api/barang-keluar",
        {

          method:"POST",

          headers:{

            "Content-Type":
            "application/json"

          },


          body: JSON.stringify({
  customerId: Number(customer),
  note,
  items: cart.map((item) => ({
    barangId: item.barangId,
    qty: item.qty,
  })),
})

        }

      );



      const json =
      await res.json();



      if(json.success){


        alert(
          "Barang keluar berhasil"
        );


        setCart([]);

        setCustomer("");

        setNote("");


      }else{


        alert(
          json.message ||
          "Gagal menyimpan"
        );


      }



    }catch(error){

      console.error(error);

      alert(
        "Terjadi kesalahan"
      );

    }


  }





  return (

    <div className="p-8">


      <h1 className="text-3xl font-bold mb-6">
        Barang Keluar
      </h1>



      <div className="bg-white rounded-xl shadow p-6">


        <div className="grid grid-cols-2 gap-4 mb-6">


          <div>

            <label>
              Customer
            </label>

            <select
  className="border w-full p-3 rounded"
  value={customer}
  onChange={(e) => setCustomer(e.target.value)}
>
  <option value="">-- Pilih Customer --</option>

  {customers.map((c: any) => (
    <option key={c.id} value={c.id}>
      {c.code} - {c.name}
    </option>
  ))}
</select>

          </div>



          <div>

            <label>
              Keterangan
            </label>


            <input

              className="border w-full p-3 rounded"

              value={note}

              onChange={
                e=>setNote(e.target.value)
              }

              placeholder="Keterangan"

            />


          </div>


        </div>





        <div className="flex gap-3 mb-6">


          <select

            className="border p-3 rounded flex-1"

            value={selectedBarang}

            onChange={
              e=>setSelectedBarang(e.target.value)
            }

          >

            <option value="">
              -- Pilih Barang --
            </option>


            {
  barang.map((b:any)=>(

    <option
      key={b.id}
      value={b.id}
    >
      {b.code} - {b.name} | Stock: {b.stock}
    </option>

  ))
}


          </select>




          <input

            type="number"

            className="border p-3 rounded w-32"

            placeholder="Qty"

            value={qty}

            onChange={
              e=>setQty(e.target.value)
            }

          />



          <button

            onClick={tambahBarang}

            className="bg-green-600 text-white px-5 rounded"

          >

            Tambah

          </button>


        </div>





        <table className="w-full border">


          <thead className="bg-gray-100">

            <tr>

              <th className="border p-2">
                Barang
              </th>

              <th className="border p-2">
                Satuan
              </th>

              <th className="border p-2">
                Qty
              </th>

              <th className="border p-2">
                Harga
              </th>

              <th className="border p-2">
                Total
              </th>

              <th className="border p-2">
                Aksi
              </th>

            </tr>

          </thead>


          <tbody>


          {
            cart.map((item,index)=>(


              <tr key={index}>


                <td className="border p-2">
                  {item.name}
                </td>


                <td className="border p-2 text-center">
                  {item.unit}
                </td>


                <td className="border p-2 text-center">
                  {item.qty}
                </td>


                <td className="border p-2 text-right">

                  Rp {Number(item.price).toLocaleString("id-ID")}

                </td>


                <td className="border p-2 text-right">

                  Rp {Number(item.subtotal).toLocaleString("id-ID")}

                </td>


                <td className="border p-2 text-center">

                  <button

                    onClick={()=>hapus(index)}

                    className="bg-red-500 text-white px-3 py-1 rounded"

                  >

                    Hapus

                  </button>

                </td>


              </tr>


            ))
          }


          </tbody>


        </table>





        <div className="mt-6 text-right">


          <p className="text-lg">
            Total Qty :
            <b> {totalQty}</b>
          </p>



          <p className="text-2xl font-bold">

            Total :
            {" "}
            Rp {totalNominal.toLocaleString()}

          </p>


        </div>





        <button

          onClick={simpan}

          className="mt-6 bg-blue-600 text-white px-8 py-3 rounded-lg"

        >

          Simpan Barang Keluar

        </button>


      </div>


    </div>

  );

}