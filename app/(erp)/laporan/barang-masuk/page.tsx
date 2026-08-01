"use client";

import {useEffect,useState} from "react";

import { exportReportPDF } from "@/lib/exportReportPdf";
import { exportReportExcel } from "@/lib/exportReportExcel";
import { printTable } from "@/lib/print";


export default function LaporanBarangMasuk(){


const [data,setData]=useState<any[]>([]);



useEffect(()=>{


fetch("/api/laporan/barang-masuk")

.then(res=>res.json())

.then(result=>{


setData(result.data ?? []);


})


.catch(err=>{

console.log(err);

});


},[]);





const rows:any[]=[];



data.forEach(receipt=>{


receipt.items.forEach((item:any)=>{


rows.push([


receipt.number,


new Date(receipt.receiptDate)
.toLocaleDateString("id-ID"),


receipt.supplier?.name ?? "-",


item.barang?.name ?? "-",


item.qty,


"Rp "+(item.price ?? 0)
.toLocaleString(),


"Rp "+(item.subtotal ?? 0)
.toLocaleString()



]);


});


});





const columns=[

"No Receive",

"Tanggal",

"Supplier",

"Barang",

"Qty",

"Harga",

"Total"


];





return(

<div className="p-8">


<h1 className="text-3xl font-bold mb-6">

Laporan Barang Masuk

</h1>




<div className="flex gap-3 mb-6">



<button

onClick={() =>
  exportReportPDF(
    "Laporan Barang Masuk",
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
    "Laporan Barang Masuk",
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


{
columns.map((col,index)=>(

<th
key={index}
className="p-3 text-left"
>

{col}

</th>

))
}


</tr>


</thead>




<tbody>


{

rows.length===0 ?


<tr>

<td
colSpan={7}
className="p-5 text-center"
>

Belum ada barang masuk

</td>

</tr>


:


rows.map((row,index)=>(


<tr
key={index}
className="border-t"
>


{
row.map((cell:any,i)=>(

<td
key={i}
className="p-3"
>

{cell}

</td>


))
}


</tr>


))


}



</tbody>


</table>


</div>



</div>

);


}