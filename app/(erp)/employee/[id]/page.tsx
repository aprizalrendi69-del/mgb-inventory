"use client";


import {
useEffect,
useState
} from "react";



export default function EmployeeDetailPage({

params

}:{

params:Promise<{
id:string
}>

}){


const [employee,setEmployee]=useState<any>(null);



useEffect(()=>{


load();


},[]);





async function load(){


const {id}=await params;



const res =
await fetch(
`/api/employee/${id}`
);



const json =
await res.json();



if(json.success){

setEmployee(json.data);

}


}







if(!employee){


return (

<div className="p-8">

Loading...

</div>

)

}






return (

<div className="p-8">



<h1 className="text-3xl font-bold mb-6">

Detail Karyawan

</h1>





<div className="
bg-white
shadow
rounded
p-6
mb-6
">



<h2 className="text-2xl font-bold">

{employee.name}

</h2>



<p>
NIK :
{employee.nik}
</p>



<p>
Jabatan :
{employee.position}
</p>



<p>
Department :
{employee.department || "-"}
</p>



<p>
No HP :
{employee.phone || "-"}
</p>



</div>








<div className="
bg-white
shadow
rounded
overflow-hidden
">


<h2 className="text-xl font-bold p-5">

Riwayat Absensi

</h2>




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
Check Out
</th>


<th>
Foto Masuk
</th>


<th>
Foto Pulang
</th>


</tr>


</thead>





<tbody>


{

employee.attendances.map((a:any)=>(


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
a.checkIn
?
new Date(a.checkIn)
.toLocaleTimeString("id-ID")
:
"-"
}

</td>





<td>

{
a.checkOut
?
new Date(a.checkOut)
.toLocaleTimeString("id-ID")
:
"Belum Pulang"
}

</td>






<td>


{
a.photoIn &&

<img

src={a.photoIn}

className="
w-20
rounded
"

/>

}



</td>





<td>


{
a.photoOut &&

<img

src={a.photoOut}

className="
w-20
rounded
"

/>

}



</td>




</tr>


))


}



</tbody>


</table>



</div>



</div>


)


}