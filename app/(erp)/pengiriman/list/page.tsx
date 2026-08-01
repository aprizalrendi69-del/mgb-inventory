"use client";

import {useEffect,useState} from "react";

export default function DeliveryList(){

const[data,setData]=useState([]);

async function load(){

const res=
await fetch("/api/delivery-order");

const json=
await res.json();

setData(json.data);

}

useEffect(()=>{

load();

},[]);

return(

<div className="p-8">

<div className="flex justify-between items-center">

<h1 className="text-3xl font-bold">

Delivery Order

</h1>

<a

href="/pengiriman"

className="bg-blue-600 text-white px-4 py-2 rounded"

>

Buat Delivery

</a>

</div>

<table className="w-full border mt-6">

<thead>

<tr className="bg-gray-200">

<th className="border p-2">Nomor</th>

<th className="border p-2">Customer</th>

<th className="border p-2">Tanggal</th>

<th className="border p-2">Total Item</th>

<th className="border p-2">Aksi</th>

</tr>

</thead>

<tbody>

{

data.map((d:any)=>(

<tr key={d.id}>

<td className="border p-2">

{d.number}

</td>

<td className="border p-2">

{d.customer.name}

</td>

<td className="border p-2">

{new Date(d.deliveryDate).toLocaleDateString()}

</td>

<td className="border p-2">

{d.items.length}

</td>

<td className="border p-2">

<a

href={`/pengiriman/${d.id}`}

className="bg-green-600 text-white px-3 py-1 rounded"

>

Detail

</a>

</td>

</tr>

))

}

</tbody>

</table>

</div>

)

}