"use client";


import {
useEffect,
useState
} from "react";


import Link from "next/link";



export default function AttendanceDetailPage({

params

}:{

params:Promise<{
id:string
}>

}){



const [employee,setEmployee]=
useState<any>(null);



const [month,setMonth]=
useState(
new Date().getMonth()+1
);



const [year,setYear]=
useState(
new Date().getFullYear()
);



const [loading,setLoading]=
useState(false);



const [id,setId]=
useState("");






useEffect(()=>{


async function init(){


const p =
await params;


setId(p.id);


load(
p.id
);


}


init();



},[
month,
year
]);







async function load(
employeeId:string
){


try{


setLoading(true);



const res =
await fetch(

`/api/laporan/attendance/${employeeId}?month=${month}&year=${year}`

);



const json =
await res.json();



if(json.success){

setEmployee(
json.data
);

}



}catch(error){


console.log(error);


}finally{


setLoading(false);


}



}







if(loading || !employee){


return (

<div className="p-8">

Loading...

</div>

)

}








return (

<div className="p-8">



<Link

href="/laporan/attendance"

className="
text-blue-600
font-semibold
"

>

← Kembali Laporan

</Link>







<div className="
bg-white
shadow
rounded
p-6
mt-5
">


<h1 className="
text-2xl
font-bold
">

Detail Absensi Karyawan

</h1>



<div className="mt-4">


<p>

NIK :
<b>
{employee.nik}
</b>

</p>


<p>

Nama :
<b>
{employee.name}
</b>

</p>


<p>

Jabatan :
<b>
{employee.position}
</b>

</p>



<p>

Department :
<b>
{employee.department || "-" }
</b>

</p>



</div>



</div>









<div className="
bg-white
shadow
rounded
p-5
mt-6
">


<h2 className="
font-bold
text-xl
mb-4
">

Filter

</h2>



<div className="flex gap-3">



<select

className="
border
p-3
rounded
"

value={month}

onChange={(e)=>{

setMonth(
Number(e.target.value)
);


}}

>


{

Array.from(
{
length:12
},
(_,i)=>(


<option

key={i}

value={i+1}

>

Bulan {i+1}

</option>


)

)


}



</select>





<input

type="number"

className="
border
p-3
rounded
"

value={year}

onChange={(e)=>{

setYear(
Number(e.target.value)
)

}}


/>



</div>



</div>









<div className="
bg-white
shadow
rounded
overflow-hidden
mt-6
">



<table className="w-full">


<thead className="bg-gray-100">


<tr>


<th className="p-3">
Tanggal
</th>


<th>
Check In
</th>


<th>
Foto Masuk
</th>


<th>
Check Out
</th>


<th>
Foto Keluar
</th>


<th>
Status
</th>


</tr>


</thead>







<tbody>


{

employee.attendances.length===0 &&


<tr>

<td
colSpan={6}
className="p-5 text-center"
>

Belum ada absensi

</td>


</tr>


}








{

employee.attendances.map(
(a:any)=>(


<tr

key={a.id}

className="
border-t
"


>


<td className="p-3">


{
new Date(
a.date
)
.toLocaleDateString(
"id-ID"
)
}


</td>





<td>


{

a.checkIn ?

new Date(
a.checkIn
)
.toLocaleTimeString(
"id-ID"
)

:

"-"


}



</td>








<td>


{

a.photoIn &&


<img

src={a.photoIn}

className="
w-24
h-24
object-cover
rounded
border
"

/>


}



</td>







<td>


{

a.checkOut ?

new Date(
a.checkOut
)
.toLocaleTimeString(
"id-ID"
)

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
w-24
h-24
object-cover
rounded
border
"

/>


}



</td>








<td>


{

a.checkOut ?


<span className="
bg-green-100
text-green-700
px-3
py-1
rounded
">

Selesai

</span>


:


<span className="
bg-yellow-100
text-yellow-700
px-3
py-1
rounded
">

Belum Pulang

</span>


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