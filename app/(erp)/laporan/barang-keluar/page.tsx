"use client";

import { useEffect, useState } from "react";
import { exportReportPdf } from "@/lib/exportReportPdf";
import { exportReportExcel } from "@/lib/exportReportExcel";
import { printTable } from "@/lib/print";


export default function LaporanBarangKeluar(){

const [data,setData]=useState<any[]>([]);

const [totalQty,setTotalQty]=useState(0);
const [totalNominal,setTotalNominal]=useState(0);


const [start,setStart]=useState("");
const [end,setEnd]=useState("");



async function loadData(){

let url="/api/laporan/barang-keluar";


if(start && end){

url+=`?start=${start}&end=${end}`;

}


const res=await fetch(url);

const result=await res.json();


setData(result.data ?? []);


let qty=0;
let nominal=0;


(result.data ?? []).forEach((item:any)=>{

item.items?.forEach((detail:any)=>{

qty += detail.qty;

nominal += Number(detail.subtotal ?? 0);

});


});


setTotalQty(qty);
setTotalNominal(nominal);


}



useEffect(()=>{

loadData();

},[]);

const columns = [
  "No",
  "Tanggal",
  "Customer",
  "Barang",
  "Qty",
  "Subtotal",
];

const rows: any[] = [];

data.forEach((delivery: any, index: number) => {
  delivery.items?.forEach((item: any) => {
    rows.push([
      index + 1,
      new Date(delivery.deliveryDate).toLocaleDateString("id-ID"),
      delivery.customer?.name ?? "-",
      item.barang?.name ?? "-",
      item.qty,
      "Rp " + Number(item.subtotal ?? 0).toLocaleString("id-ID"),
    ]);
  });
});

return (

<div className="p-8">


<h1 className="text-3xl font-bold mb-6">
Laporan Barang Keluar
</h1>



<div className="bg-white rounded-xl shadow p-5 mb-6">


<div className="flex gap-3 items-end">


<div>

<label className="block text-sm">
Tanggal Awal
</label>

<input
type="date"
className="border p-2 rounded"
value={start}
onChange={(e)=>setStart(e.target.value)}
/>

</div>



<div>

<label className="block text-sm">
Tanggal Akhir
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
className="bg-blue-600 text-white px-4 py-2 rounded"
>
Filter
</button>


</div>


</div>



<div className="grid grid-cols-3 gap-4 mb-6">


<div className="bg-white shadow rounded-xl p-5">

<p>Total Transaksi</p>

<h2 className="text-2xl font-bold">
{data.length}
</h2>

</div>



<div className="bg-white shadow rounded-xl p-5">

<p>Total Qty Keluar</p>

<h2 className="text-2xl font-bold">
{totalQty}
</h2>

</div>



<div className="bg-white shadow rounded-xl p-5">

<p>Total Nominal</p>

<h2 className="text-2xl font-bold">

Rp {totalNominal.toLocaleString("id-ID")}

</h2>

</div>


</div>




<div className="flex gap-3 mb-5">


<button
className="bg-red-600 text-white px-4 py-2 rounded"
onClick={() =>
  exportReportPdf(
    "Laporan Barang Keluar",
    columns,
    rows
  )
}
>
Export PDF
</button>



<button
onClick={() =>
  exportReportExcel(
    "Laporan Barang Keluar",
    columns,
    rows
  )
}
>
Export Excel
</button>



<button
className="bg-gray-700 text-white px-4 py-2 rounded"
onClick={()=>printTable("laporan-barang-keluar")}
>
Print
</button>


</div>





<div
id="laporan-barang-keluar"
className="bg-white shadow rounded-xl overflow-hidden"
>


<table className="w-full">


<thead className="bg-gray-100">

<tr>

<th className="p-3 text-left">
No
</th>

<th className="p-3 text-left">
Tanggal
</th>

<th className="p-3 text-left">
Customer
</th>

<th className="p-3 text-left">
Barang
</th>

<th className="p-3 text-right">
Qty
</th>

<th className="p-3 text-right">
Subtotal
</th>

</tr>

</thead>



<tbody>


{
data.map((delivery:any,index:number)=>(

delivery.items?.map((item:any)=>(
<tr
key={item.id}
className="border-t"
>


<td className="p-3">
{index+1}
</td>


<td className="p-3">

{
new Date(delivery.deliveryDate)
.toLocaleDateString("id-ID")
}

</td>


<td className="p-3">

{
delivery.customer?.name
}

</td>



<td className="p-3">

{
item.barang?.name
}

</td>



<td className="p-3 text-right">

{
item.qty
}

</td>



<td className="p-3 text-right">

Rp {item.subtotal?.toLocaleString("id-ID")}

</td>


</tr>
))

))
}


</tbody>


</table>


</div>


</div>

);


}