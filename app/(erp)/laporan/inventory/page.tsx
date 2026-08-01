"use client";

import { useEffect, useState } from "react";

export default function Page(){

const [data,setData]=useState<any[]>([]);
const [loading,setLoading]=useState(true);


useEffect(()=>{

fetch("/api/inventory")
.then(res=>res.json())
.then(result=>{

console.log(result);

setData(result.data || []);

setLoading(false);

});

},[]);



if(loading){

return(

<div className="p-6">
Loading laporan inventory...
</div>

)

}


return(

<div className="p-6">


<h1 className="text-3xl font-bold mb-6">
Laporan Inventory
</h1>



<div className="bg-white rounded shadow overflow-auto">


<table className="w-full">


<thead className="bg-slate-200">

<tr>

<th className="p-3 text-left">
Kode
</th>

<th className="p-3 text-left">
Nama Barang
</th>

<th className="p-3 text-left">
Kategori
</th>

<th className="p-3 text-left">
Stock
</th>

<th className="p-3 text-left">
Harga
</th>

<th className="p-3 text-left">
Nilai Asset
</th>


</tr>

</thead>



<tbody>


{
data.map((item)=>(
<tr key={item.id} className="border-b">


<td className="p-3">
{item.code}
</td>


<td className="p-3">
{item.name}
</td>


<td className="p-3">
{item.category}
</td>


<td className="p-3">
{item.stock}
</td>


<td className="p-3">
Rp {item.purchasePrice?.toLocaleString()}
</td>


<td className="p-3">
Rp {(item.stock * item.purchasePrice)?.toLocaleString()}
</td>


</tr>
))
}



</tbody>


</table>


</div>


</div>


)

}