"use client";

import {useEffect,useState} from "react";


export default function SupplierPage(){

const [data,setData]=useState<any[]>([]);


useEffect(()=>{

fetch("/api/supplier")
.then(r=>r.json())
.then(d=>{

if(Array.isArray(d))
setData(d);

});

},[]);



return(

<div className="p-6">

<h1 className="text-2xl font-bold">
Data Supplier
</h1>


<table className="w-full border mt-5">

<thead className="bg-slate-200">

<tr>

<th>Kode</th>
<th>Nama</th>
<th>Phone</th>

</tr>

</thead>


<tbody>

{
data.map(x=>(

<tr key={x.id}>

<td>{x.code}</td>

<td>{x.name}</td>

<td>{x.phone}</td>

</tr>

))
}

</tbody>


</table>


</div>

)

}