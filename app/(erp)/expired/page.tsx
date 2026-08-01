"use client";

import {useEffect,useState} from "react";


export default function ExpiredPage(){

const [data,setData]=useState<any[]>([]);


useEffect(()=>{

load();

},[]);


async function load(){

const res=await fetch("/api/barang-batch");

const json=await res.json();


if(json.success){

setData(json.data);

}

}



return(

<div className="p-8">

<h1 className="text-3xl font-bold mb-5">
Expired Barang
</h1>


<table className="w-full border">


<thead>

<tr>

<th className="border p-2">
Barang
</th>

<th className="border p-2">
Batch
</th>

<th className="border p-2">
Qty
</th>

<th className="border p-2">
Expired
</th>

</tr>

</thead>


<tbody>

{
data.map((x)=>(

<tr key={x.id}>

<td className="border p-2">
{x.barang.name}
</td>


<td className="border p-2">
{x.batchNumber}
</td>


<td className="border p-2">
{x.qty}
</td>


<td className="border p-2">

{
new Date(x.expiredDate)
.toLocaleDateString("id-ID")
}

</td>


</tr>

))
}


</tbody>


</table>


</div>

)

}