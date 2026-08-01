"use client";

import {useEffect,useState} from "react";


export default function CustomerPage(){

const [data,setData]=useState<any[]>([]);


useEffect(()=>{

fetch("/api/customer")
.then(r=>r.json())
.then(d=>{

if(Array.isArray(d))
setData(d);

});


},[]);



return(

<div className="p-6">

<h1 className="text-2xl font-bold">
Customer
</h1>


<table className="border w-full mt-5">

<thead>

<tr>

<th>Kode</th>
<th>Nama</th>
<th>Telepon</th>

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