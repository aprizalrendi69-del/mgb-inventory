"use client";


import {
useEffect,
useState
} from "react";



export default function LaporanPage(){


const [type,setType]=
useState("stock");


const [data,setData]=
useState<any[]>([]);





async function load(){


const res =
await fetch(
`/api/laporan?type=${type}`
);



const result =
await res.json();



if(result.success){

setData(result.data);

}


}





useEffect(()=>{


load();


},[type]);






return (

<div className="p-6">


<div className="bg-white shadow rounded-xl p-6">



<h1 className="text-2xl font-bold mb-6">

Laporan ERP

</h1>





<div className="flex gap-3 mb-6">


<button

onClick={()=>setType("stock")}

className="
bg-blue-600
text-white
px-4
py-2
rounded
"

>

Stock

</button>




<button

onClick={()=>setType("barang-masuk")}

className="
bg-green-600
text-white
px-4
py-2
rounded
"

>

Barang Masuk

</button>




<button

onClick={()=>setType("barang-keluar")}

className="
bg-red-600
text-white
px-4
py-2
rounded
"

>

Barang Keluar

</button>




<button

onClick={()=>setType("purchase")}

className="
bg-gray-700
text-white
px-4
py-2
rounded
"

>

Purchase

</button>



</div>






<table className="w-full border">


<thead>


<tr className="bg-gray-100">


<th className="border p-2">

No

</th>


<th className="border p-2">

Data

</th>


<th className="border p-2">

Status

</th>


</tr>


</thead>




<tbody>


{

data.map(

(item,index)=>(


<tr key={item.id}>


<td className="border p-2">

{index+1}

</td>



<td className="border p-2">


{

item.number ||

item.barang?.name ||

"-"

}


</td>



<td className="border p-2">


{

item.status ||

"ACTIVE"

}


</td>



</tr>


)


)


}



</tbody>


</table>




</div>


</div>


)


}