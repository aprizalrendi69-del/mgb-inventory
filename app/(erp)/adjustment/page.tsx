"use client";

import { useEffect, useState } from "react";
import {
  SlidersHorizontal,
  CalendarDays,
  FileText,
  ClipboardCheck,
} from "lucide-react";


export default function AdjustmentPage(){


const [data,setData]=useState<any[]>([]);



async function load(){


const res =
await fetch(
"/api/adjustment"
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

<div className="p-6 lg:p-8">


{/* HEADER */}

<div className="mb-6">


<h1 className="
text-3xl
font-bold
text-[#29483A]
flex
items-center
gap-3
">


<SlidersHorizontal
size={30}
className="text-[#497F70]"
/>


Adjustment Stock


</h1>



<p className="
mt-2
text-sm
text-[#71827A]
">


Kelola penyesuaian stok inventory


</p>



</div>






<div className="
rounded-2xl
border
border-[#D5E5DC]
bg-[#F9FCFA]
shadow-[0_4px_20px_rgba(73,127,112,0.05)]
overflow-hidden
">



<div className="
overflow-x-auto
">


<table className="
w-full
min-w-[900px]
border-collapse
">


<thead>


<tr className="
bg-[#E8F3EC]
text-[#29483A]
">


<th className="
p-4
text-left
text-sm
font-semibold
">

No

</th>


<th className="
p-4
text-left
text-sm
font-semibold
">

Nomor

</th>


<th className="
p-4
text-left
text-sm
font-semibold
">

Tanggal

</th>


<th className="
p-4
text-left
text-sm
font-semibold
">

Type

</th>


<th className="
p-4
text-left
text-sm
font-semibold
">

Alasan

</th>


<th className="
p-4
text-left
text-sm
font-semibold
">

Status

</th>


</tr>


</thead>






<tbody>


{
data.length > 0 ? (

data.map((item,index)=>(


<tr

key={item.id}

className="
border-t
border-[#E5EEE9]
hover:bg-[#F1F7F3]
transition
"

>


<td className="
p-4
text-sm
text-[#40584C]
">

{index+1}

</td>




<td className="
p-4
text-sm
font-semibold
text-[#29483A]
">


<div className="
flex
items-center
gap-2
">


<FileText
size={15}
className="text-[#497F70]"
/>


{item.number}


</div>


</td>





<td className="
p-4
text-sm
text-[#71827A]
">


<div className="
flex
items-center
gap-2
">


<CalendarDays
size={15}
/>


{
new Date(item.date)
.toLocaleDateString(
"id-ID"
)
}


</div>


</td>





<td className="p-4">


<span className="
rounded-lg
bg-[#E8F3EC]
px-3
py-1
text-xs
font-semibold
text-[#497F70]
">


{item.type}


</span>


</td>






<td className="
p-4
text-sm
text-[#40584C]
">


{item.reason ?? "-"}


</td>






<td className="p-4">


<span
className={`
rounded-lg
px-3
py-1
text-xs
font-semibold

${
item.status === "APPROVED"

?

"bg-[#E8F3EC] text-[#497F70]"

:

item.status === "REJECTED"

?

"bg-[#FBE9E7] text-[#B56F61]"

:

"bg-[#FFF5E9] text-[#A67B39]"
}

`}
>


{item.status}


</span>


</td>






</tr>


))


)

:

(

<tr>


<td
colSpan={6}
className="
p-10
text-center
text-sm
text-[#71827A]
"


>


<ClipboardCheck
size={32}
className="
mx-auto
mb-3
text-[#A9CDB8]
"
/>


Belum ada data adjustment


</td>


</tr>


)

}



</tbody>



</table>


</div>



</div>



</div>

);


}