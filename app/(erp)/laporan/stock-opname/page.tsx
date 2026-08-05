"use client";


import { useEffect,useState } from "react";
import Link from "next/link";


export default function LaporanStockOpnamePage(){


const [data,setData]=
useState<any[]>([]);


const [loading,setLoading]=
useState(true);




async function loadData(){


try{


const res =
await fetch(
"/api/laporan/stock-opname",
{
cache:"no-store"
}
);



const json =
await res.json();



if(json.success){

setData(
json.data
);

}



}catch(error){

console.error(error);

}


setLoading(false);


}






useEffect(()=>{


loadData();


},[]);







return (

<div className="p-6">


<h1 className="
text-2xl
font-bold
mb-2
">

Laporan Stock Opname

</h1>



<p className="
text-gray-500
mb-6
">

Riwayat pemeriksaan stok fisik gudang

</p>






<div className="
bg-white
shadow
rounded
overflow-hidden
">



<table className="w-full">



<thead>


<tr className="bg-gray-100">



<th className="border p-3">
No
</th>


<th className="border p-3">
Kode
</th>


<th className="border p-3">
Tanggal
</th>


<th className="border p-3">
Status
</th>


<th className="border p-3">
Jumlah Item
</th>


<th className="border p-3">
Total Selisih
</th>


<th className="border p-3">
Aksi
</th>


</tr>


</thead>






<tbody>



{

loading ?


<tr>

<td
colSpan={7}
className="p-5 text-center"
>

Loading...

</td>

</tr>



:


data.length===0 ?


<tr>

<td
colSpan={7}
className="p-5 text-center"
>

Belum ada data

</td>

</tr>



:


data.map(

(item,index)=>(


<tr key={item.id}>


<td className="border p-3 text-center">

{index+1}

</td>



<td className="border p-3">

{item.code}

</td>



<td className="border p-3">

{

new Date(
item.date
)
.toLocaleDateString(
"id-ID"
)

}

</td>



<td className="border p-3 text-center">


<span className={`
px-3
py-1
rounded

${
item.status==="APPROVED"

?

"bg-green-100 text-green-700"

:

"bg-yellow-100 text-yellow-700"

}

`}>

{item.status}

</span>


</td>



<td className="border p-3 text-center">

{item.totalItem}

</td>



<td className="border p-3 text-center">


<span
className={
item.totalDifference>0
?
"text-red-600 font-bold"
:
""
}
>

{item.totalDifference}

</span>


</td>




<td className="border p-3 text-center">


<Link

href={
`/stock-opname/${item.id}`
}

className="
bg-blue-600
text-white
px-3
py-1
rounded
"

>

Detail

</Link>


</td>



</tr>


)


)


}



</tbody>



</table>


</div>



</div>

);


}