"use client";


import {
useEffect,
useState
} from "react";



export default function AdjustmentPage(){


const [data,setData]=
useState<any[]>([]);




async function load(){


const res =
await fetch(
"/api/adjustment"
);



const result =
await res.json();



if(result.success){


setData(result.data);


}


}




useEffect(()=>{


load();


},[]);





return (

<div className="p-6">


<div className="bg-white shadow rounded-xl p-6">


<h1 className="text-2xl font-bold mb-6">

Adjustment Stock

</h1>




<table className="w-full border">


<thead>


<tr className="bg-gray-100">


<th className="border p-2">

No

</th>


<th className="border p-2">

Nomor

</th>


<th className="border p-2">

Tanggal

</th>


<th className="border p-2">

Type

</th>


<th className="border p-2">

Alasan

</th>


<th className="border p-2">

Status

</th>


</tr>


</thead>




<tbody>


{

data.map(

(item,index)=>(


<tr key={item.id}>


<td className="border p-2">

{index+1}

</td>



<td className="border p-2">

{item.number}

</td>



<td className="border p-2">

{

new Date(
item.date
)
.toLocaleDateString(
"id-ID"
)

}

</td>



<td className="border p-2">

{item.type}

</td>



<td className="border p-2">

{item.reason}

</td>



<td className="border p-2">

{item.status}

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