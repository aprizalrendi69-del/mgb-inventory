"use client";

import {useEffect,useState} from "react";


export default function AttendanceDashboard(){


const [data,setData]=useState<any[]>([]);



useEffect(()=>{

load();

},[]);



async function load(){

const res =
await fetch("/api/attendance");


const json =
await res.json();


if(json.success){

setData(json.data);

}

}



function today(){

return new Date()
.toISOString()
.substring(0,10);

}



const todayData =
data.filter(
(a)=>
new Date(a.date)
.toISOString()
.substring(0,10)
===today()
);



return (

<div className="p-8">


<h1 className="text-3xl font-bold mb-6">
Dashboard Attendance
</h1>



<div className="grid grid-cols-3 gap-5 mb-8">



<div className="bg-white shadow rounded p-5">

<h3>Total Pegawai Hadir</h3>

<p className="text-3xl font-bold">

{todayData.length}

</p>

</div>




<div className="bg-white shadow rounded p-5">

<h3>Sudah Check Out</h3>

<p className="text-3xl font-bold">

{
todayData.filter(
(a)=>a.checkOut
).length
}

</p>

</div>




<div className="bg-white shadow rounded p-5">

<h3>Belum Check Out</h3>

<p className="text-3xl font-bold">

{
todayData.filter(
(a)=>!a.checkOut
).length
}

</p>

</div>


</div>





<div className="bg-white shadow rounded">


<table className="w-full">


<thead className="bg-gray-100">

<tr>

<th className="p-3">
Pegawai
</th>


<th>
Masuk
</th>


<th>
Keluar
</th>


<th>
Status
</th>


</tr>


</thead>



<tbody>


{
todayData.map((a)=>(


<tr key={a.id} className="border-t">


<td className="p-3">

{a.employee.name}

</td>


<td>

{
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


{
a.checkOut ?

<span className="text-green-600">
Selesai
</span>

:

<span className="text-orange-600">
Aktif
</span>

}


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