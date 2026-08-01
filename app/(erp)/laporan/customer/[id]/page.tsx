"use client";

import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import Link from "next/link";


import {exportReportPDF} from "@/lib/exportReportPdf";
import {exportReportExcel} from "@/lib/exportReportExcel";
import {printTable} from "@/lib/print";



export default function DetailCustomer(){


const params=useParams();


const id = String(params.id);
console.log("DETAIL CUSTOMER ID =", id);



const [data,setData]=useState<any>(null);


const [start,setStart]=useState("");
const [end,setEnd]=useState("");



async function loadData(){


let url =
`/api/laporan/customer/${String(id)}`;

console.log("CALL API =", url);


if(start && end){

url +=
`?start=${start}&end=${end}`;

}



const res =
await fetch(url);


const json =
await res.json();


setData(json.data);



}



useEffect(()=>{

if(id){
loadData();
}

},[id]);




if(!data){

return <div className="p-8">
Loading...
</div>

}





const rows:any[]=[];



data.deliveries.forEach((doItem:any)=>{


doItem.items.forEach((item:any)=>{


rows.push([

doItem.id,

doItem.number,

new Date(
doItem.deliveryDate
)
.toLocaleDateString("id-ID"),


item.barang.name,


item.qty,


"Rp "+
Number(item.price)
.toLocaleString("id-ID"),


"Rp "+
Number(item.subtotal)
.toLocaleString("id-ID")

]);


});


});



const columns=[

"ID DO",
"No DO",
"Tanggal",
"Barang",
"Qty",
"Harga",
"Total"

];



return (

<div className="p-8">


<h1 className="text-3xl font-bold">

{data.customer.name}

</h1>


<p>
PIC : {data.customer.pic}
</p>


<div className="bg-white shadow rounded-xl p-5 mt-5">


<div className="flex gap-3">


<input
type="date"
className="border p-2"
value={start}
onChange={
e=>setStart(e.target.value)
}
/>


<input
type="date"
className="border p-2"
value={end}
onChange={
e=>setEnd(e.target.value)
}
/>


<button
onClick={loadData}
className="bg-blue-600 text-white px-4 rounded"
>

Filter

</button>


</div>

</div>




<div className="grid grid-cols-3 gap-4 mt-5">


<div className="bg-white shadow p-5 rounded">

Total Transaksi

<h2 className="text-2xl font-bold">
{data.summary.transaksi}
</h2>

</div>


<div className="bg-white shadow p-5 rounded">

Total Qty

<h2 className="text-2xl font-bold">
{data.summary.qty}
</h2>

</div>


<div className="bg-white shadow p-5 rounded">

Total Nominal

<h2 className="text-2xl font-bold">

Rp {data.summary.nominal.toLocaleString("id-ID")}

</h2>

</div>


</div>





<div className="flex gap-3 mt-6">


<button
onClick={()=>exportReportPDF(
"Detail Customer",
columns,
rows
)}
className="bg-red-600 text-white px-4 py-2 rounded"
>
PDF
</button>



<button
onClick={()=>exportReportExcel(
"Detail Customer",
columns,
rows
)}
className="bg-green-600 text-white px-4 py-2 rounded"
>
Excel
</button>


<button
onClick={()=>printTable(
columns,
rows
)}
className="bg-gray-700 text-white px-4 py-2 rounded"
>
Print
</button>


</div>



<table className="w-full bg-white shadow mt-6">


<thead className="bg-gray-100">

<tr>

{
columns.map((c)=>(

<th className="p-3">
{c}
</th>

))
}

</tr>

</thead>


<tbody>

{
rows.map((r,i)=>(

<tr key={i} className="border-t">

{
r.map((x:any,index:number)=>(


<td className="p-3" key={index}>

{
index === 1 ?

<Link
href={`/pengiriman/${r[0]}`}
className="text-blue-600 font-semibold hover:underline"
>

{x}

</Link>


:

x

}


</td>


))
}

</tr>

))
}

</tbody>


</table>


</div>


)


}