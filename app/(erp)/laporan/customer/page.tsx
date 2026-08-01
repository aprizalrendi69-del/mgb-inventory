"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { exportReportPDF } from "@/lib/exportReportPdf";
import { exportReportExcel } from "@/lib/exportReportExcel";
import { printTable } from "@/lib/print";


export default function LaporanCustomer(){

const [data,setData]=useState<any[]>([]);

const [start,setStart]=useState("");
const [end,setEnd]=useState("");



async function loadData(){

let url="/api/laporan/customer";


if(start && end){

url += `?start=${start}&end=${end}`;

}


const res = await fetch(url);

const json = await res.json();


setData(json.data ?? []);


}



useEffect(()=>{

loadData();

},[]);




const columns=[

"Customer",
"PIC",
"Total Transaksi",
"Total Qty",
"Total Nominal"

];



const rows=data.map((item)=>[

item.name,

item.pic,

item.transaksi ?? 0,

item.qty ?? 0,

"Rp "+
(item.nominal ?? 0).toLocaleString("id-ID")

]);



return (

<div className="p-8">


<h1 className="text-3xl font-bold mb-6">
Laporan Customer
</h1>



<div className="bg-white shadow rounded-xl p-5 mb-6">


<div className="flex gap-3 items-end">


<div>

<label>
Tanggal Dari
</label>

<input
type="date"
className="border p-2 rounded"
value={start}
onChange={(e)=>setStart(e.target.value)}
/>

</div>



<div>

<label>
Tanggal Sampai
</label>

<input
type="date"
className="border p-2 rounded"
value={end}
onChange={(e)=>setEnd(e.target.value)}
/>

</div>



<button

onClick={loadData}

className="bg-blue-600 text-white px-5 py-2 rounded"

>
Filter
</button>


</div>


</div>





<div className="flex gap-3 mb-5">


<button

onClick={()=>exportReportPDF(
"Laporan Customer",
columns,
rows
)}

className="bg-red-600 text-white px-4 py-2 rounded"

>
Export PDF
</button>



<button

onClick={()=>exportReportExcel(
"Laporan Customer",
columns,
rows
)}

className="bg-green-600 text-white px-4 py-2 rounded"

>
Export Excel
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





<div className="bg-white shadow rounded-xl overflow-hidden">


<table className="w-full">


<thead className="bg-gray-100">

<tr>

<th className="p-3">
Customer
</th>

<th>
PIC
</th>

<th>
Transaksi
</th>

<th>
Qty
</th>

<th>
Nominal
</th>

</tr>

</thead>



<tbody>


{
data.map((item)=>(

<tr
key={item.id}
className="border-t"
>


<td className="p-3">

<Link

href={`/laporan/customer/${item.id}`}

className="text-blue-600 font-semibold"

>

{item.name}

</Link>

</td>



<td>
{item.pic}
</td>


<td>
{item.transaksi ?? 0}
</td>


<td>
{item.qty ?? 0}
</td>


<td>
Rp {(item.nominal ?? 0).toLocaleString("id-ID")}
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