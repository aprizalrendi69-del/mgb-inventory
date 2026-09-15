"use client";

import {useEffect,useState} from "react";


export default function PrintStockOpname(){

const [data,setData]=useState<any>(null);



useEffect(()=>{

const id =
new URLSearchParams(
window.location.search
).get("id");


fetch(
"/api/stock-opname/"+id
)
.then(r=>r.json())
.then(r=>{

if(r.success)
setData(r.data);

});


},[]);



if(!data)
return <div>
Loading...
</div>;



return (

<div className="p-10">


<h1 className="text-2xl font-bold text-center">

STOCK OPNAME

</h1>


<div className="my-5">

Nomor : {data.number}

<br/>

Tanggal :
{
new Date(
data.opnameDate
)
.toLocaleDateString("id-ID")
}

</div>



<table className="w-full border">


<thead>

<tr>

<th className="border p-2">
Barang
</th>

<th className="border p-2">
System
</th>

<th className="border p-2">
Fisik
</th>

<th className="border p-2">
Selisih
</th>

</tr>

</thead>



<tbody>


{
data.items.map((item:any)=>(

<tr key={item.id}>


<td className="border p-2">

{item.barang.name}

</td>


<td className="border p-2 text-center">

{item.systemQty}

</td>


<td className="border p-2 text-center">

{item.physicalQty}

</td>


<td className="border p-2 text-center">

{item.difference}

</td>


</tr>


))
}



</tbody>


</table>



<button

onClick={()=>window.print()}

className="mt-5 bg-blue-600 text-white px-5 py-2 rounded"

>

Print

</button>



</div>


)

}