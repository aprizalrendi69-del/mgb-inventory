"use client";

import { useEffect,useState } from "react";

export default function ApprovePage(){

const [data,setData]=useState<any[]>([]);

useEffect(()=>{

load();

},[]);

async function load(){

const res=await fetch("/api/purchase");

const json=await res.json();

if(json.success){

setData(

json.data.filter(

(x:any)=>x.status==="APPROVED"

)

);

}

}

return(

<div className="p-8">

<h1 className="text-3xl font-bold mb-5">

Purchase Approved

</h1>

<table className="w-full border">

<thead>

<tr>

<th className="border p-2">

No PO

</th>

<th className="border p-2">

Supplier

</th>

<th className="border p-2">

Tanggal

</th>

<th className="border p-2">

Total

</th>

</tr>

</thead>

<tbody>

{

data.map((x:any)=>(

<tr key={x.id}>

<td className="border p-2">

{x.number}

</td>

<td className="border p-2">

{x.supplier?.name ?? "-"}

</td>

<td className="border p-2">

{

new Date(x.purchaseDate)

.toLocaleDateString("id-ID")

}

</td>

<td className="border p-2 text-right">

Rp {(x.total ?? 0).toLocaleString("id-ID")}

</td>

</tr>

))

}

</tbody>

</table>

</div>

);

}