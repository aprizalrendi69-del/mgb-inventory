"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { exportSuratJalanPDF } from "@/lib/exportSuratJalanPdf";
import { exportSuratJalanExcel } from "@/lib/exportSuratJalanExcel";


export default function SuratJalanDetailPage(){

  const { id } = useParams();

  const [data,setData] = useState<any>(null);



  async function load(){

    const res =
      await fetch(
        `/api/delivery-order/${id}`
      );


    const json =
      await res.json();


    if(json.success){

      setData(json.data);

    }

  }



  useEffect(()=>{

    if(id){

      load();

    }

  },[id]);





  async function processDelivery(){

    if(
      !confirm(
        "Release Delivery Order?"
      )
    )
    return;



    const res =
      await fetch(
        `/api/delivery-order/${id}/approve`,
        {
          method:"PUT"
        }
      );


    const json =
      await res.json();


    alert(
      json.message
    );


    if(json.success){

      load();

    }

  }





  if(!data){

    return (

      <div className="p-8">
        Loading...
      </div>

    );

  }





  const total =
    data.items.reduce(
      (
        sum:number,
        item:any
      )=>
        sum +
        Number(
          item.subtotal ||
          item.qty * item.price
        ),
      0
    );





return (

<div className="p-8">


<div className="bg-white shadow rounded-xl p-8">



<div className="flex justify-between items-center mb-8">


<div>

<h1 className="text-3xl font-bold">

SURAT JALAN

</h1>


<p className="text-gray-500">

PT. Mitra Garam Bogatama

</p>


</div>





<div className="flex gap-3">



{
data.status==="DRAFT" &&

<button

onClick={processDelivery}

className="
bg-orange-600
text-white
px-5
py-2
rounded
"

>

Proses Pengiriman

</button>

}






<button

onClick={()=>exportSuratJalanPDF(data)}

className="
bg-red-600
text-white
px-5
py-2
rounded
"

>

Export PDF

</button>






<button

onClick={()=>exportSuratJalanExcel(data)}

className="
bg-green-600
text-white
px-5
py-2
rounded
"

>

Export Excel

</button>






<a

href={`/surat-jalan/print?id=${data.id}`}

target="_blank"

className="
bg-blue-600
text-white
px-5
py-2
rounded
"

>

Print

</a>



</div>



</div>





<div className="grid grid-cols-2 gap-5 mb-8">


<div>

<b>No Surat Jalan</b>

<br/>

{data.suratJalan?.number}

</div>



<div>

<b>No Delivery</b>

<br/>

{data.number}

</div>



<div>

<b>Customer</b>

<br/>

{data.customer?.name}

</div>



<div>

<b>Tanggal</b>

<br/>

{
new Date(
data.deliveryDate
)
.toLocaleDateString("id-ID")
}

</div>


</div>





<table className="w-full border border-collapse">


<thead className="bg-gray-100">


<tr>

<th className="border p-2">
No
</th>


<th className="border p-2">
Kode
</th>


<th className="border p-2">
Nama Barang
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
Subtotal
</th>


</tr>


</thead>




<tbody>


{
data.items.map(
(item:any,index:number)=>(


<tr key={item.id}>


<td className="border p-2 text-center">

{index+1}

</td>



<td className="border p-2">

{item.barang?.code}

</td>



<td className="border p-2">

{item.barang?.name}

</td>



<td className="border p-2 text-center">

{item.barang?.unit}

</td>



<td className="border p-2 text-center">

{item.qty}

</td>



<td className="border p-2 text-right">

Rp {Number(item.price)
.toLocaleString("id-ID")}

</td>



<td className="border p-2 text-right">

Rp {Number(item.subtotal)
.toLocaleString("id-ID")}

</td>


</tr>


)

)

}


</tbody>


</table>





<div className="flex justify-end mt-6">


<div className="text-xl font-bold">

TOTAL :

Rp {total.toLocaleString("id-ID")}

</div>


</div>





<div className="grid grid-cols-3 text-center mt-24">


<div>

Dibuat

<br/><br/><br/><br/>

_________________

</div>



<div>

Gudang

<br/><br/><br/><br/>

_________________

</div>



<div>

Penerima

<br/><br/><br/><br/>

_________________

</div>



</div>




</div>


</div>


);


}