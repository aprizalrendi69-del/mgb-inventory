"use client";


import {
useEffect,
useState
} from "react";



export default function StockCardPage(){


const [data,setData]=
useState<any[]>([]);



async function load(){


const res =
await fetch(
"/api/stock-card"
);



const result =
await res.json();



if(result.success){

setData(
result.data
);

}


}





useEffect(()=>{


load();


},[]);





return (

<div className="p-6">


<div className="bg-white shadow rounded-xl p-6">


<h1 className="text-2xl font-bold mb-6">

Stock Card

</h1>




<table className="w-full border">


<thead>


<tr className="bg-gray-100">


<th className="border p-2">

Tanggal

</th>


<th className="border p-2">

Barang

</th>


<th className="border p-2">

Transaksi

</th>


<th className="border p-2">

Qty

</th>


<th className="border p-2">

Saldo

</th>



</tr>


</thead>



<tbody>


{

data.map(

(item:any)=>(


<tr key={item.id}>


<td className="border p-2">


{

new Date(
item.createdAt
)
.toLocaleDateString(
"id-ID"
)

}


</td>




<td className="border p-2">

{

item.barang.name

}

</td>




<td className="border p-2">

{

item.type==="IN"

?

"BARANG MASUK"

:

"BARANG KELUAR"

}


</td>




<td className="border p-2 text-center">
  {item.qtyIn > 0 ? `+${item.qtyIn}` : `-${item.qtyOut}`}
</td>

<td className="border p-2 text-center font-bold">
  {item.balance}
</td>



</tr>


)


)

}


</tbody>



</table>




</div>


</div>


)


}