"use client";

import { useEffect, useState } from "react";


export default function MutasiStockPage(){

const [data,setData]=useState<any[]>([]);



async function load(){

try{

const res =
await fetch("/api/mutasi-stock");


const result =
await res.json();


console.log(result);


if(result.success){

setData(result.data);

}


}catch(error){

console.log(error);

}


}



useEffect(()=>{

load();

},[]);



return (

<div className="p-6">


<div className="bg-white rounded-xl shadow p-6">


<h1 className="text-2xl font-bold mb-5">
Mutasi Stock
</h1>



<table className="w-full border">


<thead>

<tr className="bg-gray-100">

<th className="border p-2">
No
</th>


<th className="border p-2">
Tanggal
</th>


<th className="border p-2">
Barang
</th>


<th className="border p-2">
Type
</th>


<th className="border p-2">
Qty
</th>


<th className="border p-2">
Stock Sebelum
</th>


<th className="border p-2">
Stock Sesudah
</th>


<th className="border p-2">
Referensi
</th>


</tr>


</thead>



<tbody>


{
data.length > 0 ?


data.map((item,index)=>(


<tr key={item.id}>


<td className="border p-2">
{index+1}
</td>


<td className="border p-2">

{
new Date(item.createdAt)
.toLocaleDateString("id-ID")
}

</td>


<td className="border p-2">

{
item.barang?.name ?? "-"
}

</td>



<td className="border p-2">

{
item.type
}

</td>



<td className="border p-2 text-center">

{
item.qty
}

</td>



<td className="border p-2 text-center">

{
item.stockBefore
}

</td>



<td className="border p-2 text-center">

{
item.stockAfter
}

</td>



<td className="border p-2">

{
item.reference ?? "-"
}

</td>



</tr>


))


:


<tr>

<td
colSpan={8}
className="text-center p-5 text-gray-500"
>

Belum ada mutasi stock

</td>

</tr>


}


</tbody>


</table>


</div>


</div>


)


}