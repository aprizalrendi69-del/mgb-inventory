"use client";


import {
useEffect,
useState
} from "react";



export default function AttendanceHistory(){



const [data,setData]=useState<any[]>([]);


const [employees,setEmployees]=useState<any[]>([]);



const [employeeId,setEmployeeId]=useState("");

const [start,setStart]=useState("");

const [end,setEnd]=useState("");





useEffect(()=>{

loadEmployee();

load();

},[]);






async function loadEmployee(){


const res =
await fetch("/api/employee");


const json =
await res.json();


if(json.success){

setEmployees(json.data);

}


}






async function load(){


let url =
"/api/attendance/history";



const params =
new URLSearchParams();



if(employeeId)
params.append(
"employeeId",
employeeId
);


if(start)
params.append(
"start",
start
);


if(end)
params.append(
"end",
end
);



if(params.toString()){

url += "?"+params.toString();

}




const res =
await fetch(url);



const json =
await res.json();



if(json.success){

setData(json.data);

}



}







return (

<div className="p-8">


<h1 className="
text-3xl
font-bold
mb-6
">

Riwayat Absensi

</h1>





<div className="
bg-white
p-5
rounded
shadow
mb-6
flex
gap-3
">





<select

className="
border
p-3
rounded
"

value={employeeId}

onChange={(e)=>
setEmployeeId(e.target.value)
}

>


<option value="">

Semua Karyawan

</option>



{
employees.map((e)=>(

<option

key={e.id}

value={e.id}

>

{e.name}

</option>

))

}


</select>





<input

type="date"

className="border p-3 rounded"

value={start}

onChange={(e)=>
setStart(e.target.value)
}

/>





<input

type="date"

className="border p-3 rounded"

value={end}

onChange={(e)=>
setEnd(e.target.value)
}

/>





<button

onClick={load}

className="
bg-blue-600
text-white
px-5
rounded
"

>

Cari

</button>



</div>







<div className="
bg-white
rounded
shadow
overflow-hidden
">


<table className="w-full">


<thead className="bg-gray-100">


<tr>

<th className="p-3">
Tanggal
</th>


<th>
Nama
</th>


<th>
Check In
</th>


<th>
Foto In
</th>


<th>
Check Out
</th>


<th>
Foto Out
</th>


<th>
Status
</th>


</tr>


</thead>





<tbody>


{
data.map((a)=>(


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

{a.employee.name}

<br/>

<span className="text-sm text-gray-500">

{a.employee.department}

</span>


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
a.photoIn &&

<img

src={a.photoIn}

className="
w-16
h-16
rounded
object-cover
"

/>

}


</td>







<td>


{
a.checkOut

?

new Date(a.checkOut)
.toLocaleTimeString("id-ID")

:

"-"

}


</td>






<td>


{
a.photoOut &&

<img

src={a.photoOut}

className="
w-16
h-16
rounded
object-cover
"

/>

}


</td>







<td>


{
a.checkOut

?

<span className="text-green-600">
Selesai
</span>

:

<span className="text-red-600">
Belum Pulang
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