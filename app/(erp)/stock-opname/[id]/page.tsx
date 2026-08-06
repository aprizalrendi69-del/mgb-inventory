"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import StockOpnameScanner from "@/components/StockOpnameScanner";

export default function StockOpnameDetailPage(){

  const params = useParams();
  const router = useRouter();

  const id = params.id;


  const [data,setData] =
  useState<any>(null);


  const [loading,setLoading] =
  useState(true);


  const [scanResult,setScanResult] =
  useState("");


  const [showScanner,setShowScanner] =
  useState(false);



  async function loadData(){

    try{

      const res =
      await fetch(
        `/api/stock-opname/${id}`,
        {
          cache:"no-store"
        }
      );


      const json =
      await res.json();


      console.log(
        "DETAIL:",
        json
      );


      if(json.success){

        setData(json.data);

      }


    }catch(error){

      console.error(error);

    }


    setLoading(false);

  }





  useEffect(()=>{

    if(id){

      loadData();

    }

  },[id]);







  async function updateQty(
    itemId:number,
    qty:number
  ){

    try{


      await fetch(
        `/api/stock-opname/${id}`,
        {

          method:"PATCH",

          headers:{
            "Content-Type":"application/json"
          },

          body:JSON.stringify({

            itemId,

            physicalQty:qty

          })

        }
      );


      loadData();


    }catch(error){

      console.error(error);

    }


  }







  function findBarangByBarcode(
    barcode:string
  ){


    if(!data?.items)
    return;



    const found =
    data.items.find(
      (item:any)=>
      item.barang?.barcode === barcode
    );



    if(found){


      alert(
        `Barang ditemukan: ${found.barang.name}`
      );



      const el =
      document.getElementById(
        `item-${found.id}`
      );



      if(el){

        el.scrollIntoView({
          behavior:"smooth",
          block:"center"
        });

      }



    }else{


      alert(
        "Barcode tidak ditemukan dalam Stock Opname"
      );


    }


  }









  async function approve(){


    const ok =
    confirm(
      "Approve Stock Opname?"
    );


    if(!ok)
    return;



    const res =
    await fetch(
      `/api/stock-opname/${id}`,
      {
        method:"POST"
      }
    );



    const json =
    await res.json();



    alert(
      json.message
    );



    if(json.success){

      router.push(
        "/stock-opname"
      );

    }


  }









  if(loading){

    return(
      <div className="p-6">
        Loading...
      </div>
    );

  }




  if(!data){

    return(
      <div className="p-6">
        Data tidak ditemukan
      </div>
    );

  }








return (

<div className="p-6">



<div className="
flex
justify-between
items-start
mb-6
">



<div>


<h1 className="
text-2xl
font-bold
">

Stock Opname {data.code}

</h1>



<p className="mt-2">

Status :

<span className="
ml-2
font-bold
">

{data.status}

</span>

</p>



<p>

Tanggal :

{" "}

{
new Date(data.date)
.toLocaleDateString(
"id-ID"
)
}

</p>


</div>





<div className="
flex
gap-2
">



<button

onClick={()=>setShowScanner(true)}

className="
bg-purple-600
text-white
px-4
py-2
rounded
"

>

📷 SCAN BARCODE

</button>




<button

onClick={()=>window.print()}

className="
bg-gray-700
text-white
px-4
py-2
rounded
"

>

PRINT

</button>





<a

href={`/api/laporan/stock-opname/${id}/pdf`}

target="_blank"

className="
bg-red-600
text-white
px-4
py-2
rounded
"

>

PDF

</a>





<a

href={`/api/laporan/stock-opname/${id}/excel`}

className="
bg-green-600
text-white
px-4
py-2
rounded
"

>

EXCEL

</a>







{
data.status !== "APPROVED" &&


<button

onClick={approve}

className="
bg-blue-600
text-white
px-4
py-2
rounded
"

>

APPROVE

</button>

}


</div>


</div>










{
showScanner && (

<div className="
mb-5
p-4
bg-gray-100
rounded
">


<h3 className="font-bold mb-3">

Scan Barcode Barang

</h3>



<input

autoFocus

className="
border
p-2
w-full
"

placeholder="Scan barcode..."

value={scanResult}

onChange={(e)=>{


const value =
e.target.value;


setScanResult(value);



if(value.length >= 3){


findBarangByBarcode(value);


setScanResult("");


}



}}


/>




<button

onClick={()=>setShowScanner(false)}

className="
mt-3
bg-red-600
text-white
px-4
py-2
rounded
"

>

Tutup

</button>



</div>

)

}









<div className="
bg-white
rounded
shadow
overflow-hidden
">



<table className="w-full border">


<thead>

<tr className="bg-gray-100">


<th className="border p-3">
No
</th>


<th className="border p-3">
Barang
</th>


<th className="border p-3">
System
</th>


<th className="border p-3">
Fisik
</th>


<th className="border p-3">
Selisih
</th>


</tr>

</thead>



<tbody>


{

data.items.map(

(item:any,index:number)=>(


<tr

key={item.id}

id={`item-${item.id}`}

>



<td className="border p-3 text-center">

{index+1}

</td>




<td className="border p-3">

{item.barang?.name}

</td>




<td className="border p-3 text-center">

{item.systemQty}

</td>




<td className="border p-3 text-center">


<input

type="number"

value={item.physicalQty}

disabled={
data.status==="APPROVED"
}

onChange={(e)=>{

updateQty(

item.id,

Number(
e.target.value
)

);

}}

className="
border
px-2
py-1
w-24
text-center
"

/>


</td>





<td className={`

border
p-3
text-center
font-bold

${
item.difference !== 0

?

"text-red-600"

:

"text-green-600"

}

`}>

{item.difference}

</td>



</tr>


)

)


}



</tbody>


</table>


</div>



</div>


);


}