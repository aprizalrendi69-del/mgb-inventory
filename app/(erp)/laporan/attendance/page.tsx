"use client";


import { 
  useEffect,
  useState
} from "react";


import Link from "next/link";


import { 
  exportAttendanceExcel 
} from "@/lib/exportAttendanceExcel";


import { 
  exportAttendancePdf 
} from "@/lib/exportAttendancePdf";



const months = [

"Januari",
"Februari",
"Maret",
"April",
"Mei",
"Juni",
"Juli",
"Agustus",
"September",
"Oktober",
"November",
"Desember"

];




export default function LaporanAttendance(){



const [data,setData] =
useState<any[]>([]);



const [month,setMonth] =
useState(
new Date().getMonth()+1
);



const [year,setYear] =
useState(
new Date().getFullYear()
);



const [loading,setLoading] =
useState(false);





useEffect(()=>{

load();

},[
month,
year
]);






async function load(){


try{


setLoading(true);



const res =
await fetch(
`/api/laporan/attendance?month=${month}&year=${year}`
);



const json =
await res.json();




if(json.success){

setData(
json.data
);

}else{

setData([]);

}



}catch(error){


console.log(error);


}finally{


setLoading(false);


}



}








return (

<div className="p-8">



<div className="
flex
justify-between
items-center
mb-6
">


<div>


<h1 className="
text-3xl
font-bold
">

Laporan Attendance

</h1>


<p className="
text-gray-500
mt-2
">

Rekap absensi karyawan berdasarkan bulan

</p>


</div>



<button

onClick={load}

className="
bg-blue-600
text-white
px-5
py-3
rounded
"

>

Refresh

</button>



</div>









<div className="
bg-white
shadow
rounded
p-5
mb-6
">


<div className="
flex
gap-3
items-center
">


<select


className="
border
rounded
p-3
"


value={month}


onChange={(e)=>

setMonth(
Number(e.target.value)
)

}


>


{

months.map(
(m,i)=>(


<option

key={i}

value={i+1}

>


{m}


</option>


)

)

}



</select>







<input


type="number"


className="
border
rounded
p-3
"


value={year}


onChange={(e)=>

setYear(
Number(e.target.value)
)

}


/>






<button


onClick={()=>


exportAttendanceExcel(
data,
month,
year
)


}


className="
bg-green-600
text-white
px-5
py-3
rounded
"


>


Export Excel


</button>








<button


onClick={()=>


exportAttendancePdf(
data,
month,
year
)


}


className="
bg-red-600
text-white
px-5
py-3
rounded
"


>


Export PDF


</button>



</div>


</div>









<div className="
bg-white
shadow
rounded
overflow-hidden
">


{

loading &&

<div className="
p-5
text-center
">

Loading data...


</div>


}






{

!loading &&
data.length===0 &&


<div className="
p-8
text-center
text-gray-500
">


Belum ada data absensi


</div>


}







{

data.length>0 &&


<table className="
w-full
">


<thead className="
bg-gray-100
">


<tr>


<th className="
p-3
text-left
">

NIK

</th>



<th className="
p-3
text-left
">

Nama Karyawan

</th>




<th className="
p-3
text-left
">

Jabatan

</th>





<th className="
p-3
text-left
">

Department

</th>





<th className="
p-3
text-center
">

Hadir

</th>





<th className="
p-3
text-center
">

Selesai

</th>





<th className="
p-3
text-center
">

Belum Pulang

</th>



</tr>


</thead>







<tbody>


{


data.map((e)=>(


<tr

key={e.id}

className="
border-t
hover:bg-gray-50
"



>



<td className="
p-3
">

{e.nik}


</td>






<td className="
p-3
">


<Link


href={
`/laporan/attendance/${e.id}`
}


className="
text-blue-600
font-semibold
hover:underline
"


>


{e.name}


</Link>



</td>








<td className="
p-3
">

{e.position || "-"}


</td>







<td className="
p-3
">

{e.department || "-"}


</td>







<td className="
text-center
">

{e.totalHadir}


</td>







<td className="
text-center
">

{e.totalSelesai}


</td>







<td className="
text-center
">

{e.totalBelumPulang}


</td>





</tr>


))


}



</tbody>



</table>


}



</div>





</div>


);


}