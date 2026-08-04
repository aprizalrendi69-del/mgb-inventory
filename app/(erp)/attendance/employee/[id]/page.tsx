"use client";


import {useEffect,useState} from "react";
import {useParams} from "next/navigation";


export default function AttendanceEmployee(){


const params =
useParams();


const id =
params.id;



const [data,setData]=useState<any>(null);


const [month,setMonth]=useState("");



useEffect(()=>{

load();

},[]);



async function load(){


const res =
await fetch(
`/api/attendance/employee/${id}`
);



const json =
await res.json();



if(json.success){

setData(json.data);

}


}





if(!data){

return (

<div className="p-8">

Loading...

</div>

);

}



let attendance =
data.attendances;



if(month){


attendance =
attendance.filter(
(a:any)=>
new Date(a.date)
.getMonth()+1
===
Number(month)
);


}




const hadir =
attendance.length;



const selesai =
attendance.filter(
(a:any)=>a.checkOut
).length;



return (

<div className="p-8">


<h1 className="text-3xl font-bold mb-3">

{data.name}

</h1>


<p className="mb-5">

NIK : {data.nik}

</p>




<select

className="border p-3 rounded mb-5"

value={month}

onChange={(e)=>
setMonth(e.target.value)
}

>

<option value="">
Semua Bulan
</option>


<option value="1">
Januari
</option>

<option value="2">
Februari
</option>


<option value="3">
Maret
</option>


<option value="4">
April
</option>


<option value="5">
Mei
</option>


<option value="6">
Juni
</option>


<option value="7">
Juli
</option>


<option value="8">
Agustus
</option>


<option value="9">
September
</option>


<option value="10">
Oktober
</option>


<option value="11">
November
</option>


<option value="12">
Desember
</option>


</select>





<div className="grid grid-cols-3 gap-5 mb-6">


<div className="bg-white shadow p-5 rounded">

Total Hadir

<h2 className="text-3xl font-bold">

{hadir}

</h2>

</div>



<div className="bg-white shadow p-5 rounded">

Sudah Pulang

<h2 className="text-3xl font-bold">

{selesai}

</h2>

</div>



<div className="bg-white shadow p-5 rounded">

Belum Pulang

<h2 className="text-3xl font-bold">

{hadir-selesai}

</h2>

</div>


</div>






<div className="bg-white shadow rounded overflow-hidden">


<table className="w-full">


<thead className="bg-gray-100">

<tr>

<th className="p-3">
Tanggal
</th>


<th>
Masuk
</th>


<th>
Keluar
</th>


<th>
Foto
</th>


</tr>


</thead>


<tbody>


{
attendance.map((a:any)=>(


<tr
key={a.id}
className="border-t"
>


<td className="p-3">

{
new Date(a.date)
.toLocaleDateString("id-ID")

}

</td>


<td>

{
a.checkIn &&
new Date(a.checkIn)
.toLocaleTimeString("id-ID")

}

</td>


<td>

{
a.checkOut ?

new Date(a.checkOut)
.toLocaleTimeString("id-ID")

:
"-"

}

</td>



<td>


<div className="flex gap-2">


{
a.photoIn &&
<img

src={a.photoIn}

className="w-14 h-14 rounded object-cover"

/>
}




{
a.photoOut &&
<img

src={a.photoOut}

className="w-14 h-14 rounded object-cover"

/>
}


</div>


</td>



</tr>


))

}



</tbody>


</table>


</div>


</div>

);

}