"use client";

import {useEffect,useState} from "react";

import { exportReportPdf } from "@/lib/exportReportPdf";
import { exportReportExcel } from "@/lib/exportReportExcel";
import { printTable } from "@/lib/print";


export default function LaporanPurchase(){


const [data,setData]=useState<any[]>([]);



useEffect(()=>{


fetch("/api/laporan/purchase")

.then(res=>res.json())

.then(result=>{

setData(result.data ?? []);

})

.catch(error=>{

console.log(error);

});


},[]);





const columns=[

"No PO",
"Tanggal",
"Supplier",
"Status",
"Total"

];



const rows=data.map(item=>[

item.number,

new Date(item.date)
.toLocaleDateString("id-ID"),

item.supplier,

item.status,

"Rp "+(item.total ?? 0)
.toLocaleString()

]);





return(

<div className="p-8">


<h1 className="text-3xl font-bold mb-6">
Laporan Purchase Order
</h1>



<div className="flex gap-3 mb-6">


<button
  onClick={() =>
    exportReportPdf(
      "Laporan Purchase Order",
      columns,
      rows
    )
  }
  className="bg-red-600 text-white px-4 py-2 rounded-lg"
>
  Export PDF
</button>




<button
  onClick={() =>
    exportReportExcel(
      "Laporan Purchase Order",
      columns,
      rows
    )
  }
  className="bg-green-600 text-white px-4 py-2 rounded-lg"
>
  Export Excel
</button>




<button

onClick={()=>printTable(
columns,
rows
)}

className="bg-blue-600 text-white px-4 py-2 rounded-lg"

>

Print

</button>


</div>





<div className="bg-white shadow rounded-xl overflow-hidden">



<table className="w-full">



<thead className="bg-gray-100">


<tr>


<th className="p-3 text-left">
No PO
</th>


<th className="p-3 text-left">
Tanggal
</th>


<th className="p-3 text-left">
Supplier
</th>


<th className="p-3 text-left">
Status
</th>


<th className="p-3 text-right">
Total
</th>


</tr>


</thead>




<tbody>


{
data.length === 0 ? (

<tr>

<td
colSpan={5}
className="p-5 text-center"
>

Belum ada data purchase

</td>

</tr>


) : (


data.map((item)=>(


<tr

key={item.id}

className="border-t"


>



<td className="p-3">

{item.number}

</td>




<td className="p-3">

{
new Date(item.date)
.toLocaleDateString("id-ID")
}

</td>




<td className="p-3">

{item.supplier}

</td>




<td className="p-3">

{item.status}

</td>




<td className="p-3 text-right">

Rp {(item.total ?? 0)
.toLocaleString()}

</td>



</tr>


))


)


}


</tbody>


</table>


</div>


</div>

)


}