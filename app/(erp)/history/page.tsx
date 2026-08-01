"use client";


import {
useEffect,
useState
} from "react";



export default function HistoryPage(){


const [data,setData]=
useState<any[]>([]);



async function load(){


const res =
await fetch(
"/api/history"
);



const result =
await res.json();



if(result.success){


setData(result.data);


}


}




useEffect(()=>{


load();


},[]);





return (

<div className="p-6">


<div className="bg-white shadow rounded-xl p-6">



<h1 className="text-2xl font-bold mb-6">

History Transaksi

</h1>




<table className="w-full border">


<thead>


<tr className="bg-gray-100">


<th className="border p-2">

No

</th>


<th className="border p-2">

Tanggal

</th>


<th className="border p-2">

Jenis

</th>


<th className="border p-2">

Referensi

</th>


<th className="border p-2">

Keterangan

</th>


<th className="border p-2">

User

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

new Date(
item.createdAt
)
.toLocaleDateString(
"id-ID"
)

}

</td>




<td className="border p-2">

{
item.transactionType
}

</td>




<td className="border p-2">

{
item.reference
}

</td>




<td className="border p-2">

{
item.description
}

</td>




<td className="border p-2">

{
item.user?.fullname ||
"-"
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