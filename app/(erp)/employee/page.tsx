"use client";

import {
  useEffect,
  useState
} from "react";

import Link from "next/link";


export default function EmployeePage(){


  const [data,setData] =
    useState<any[]>([]);


  const [loading,setLoading] =
    useState(true);





  useEffect(()=>{

    loadEmployee();

  },[]);






  async function loadEmployee(){


    try{


      setLoading(true);



      const res =
        await fetch("/api/employee");



      const json =
        await res.json();




      if(json.success){

        setData(json.data);

      }



    }catch(error){


      console.log(error);


    }finally{


      setLoading(false);


    }


  }






return (

<div className="p-8">





<div
className="
flex
justify-between
items-center
mb-6
"
>


<div>

<h1
className="
text-3xl
font-bold
"
>

Master Karyawan

</h1>


<p
className="
text-gray-500
mt-1
"
>

Data pegawai perusahaan

</p>


</div>






<Link

href="/employee/new"

className="
bg-blue-600
hover:bg-blue-700
text-white
px-5
py-3
rounded-lg
"

>

+ Tambah Karyawan

</Link>



</div>








<div
className="
bg-white
shadow
rounded-lg
overflow-hidden
"
>





<table
className="
w-full
"
>



<thead
className="
bg-gray-100
"
>


<tr>


<th
className="
p-3
text-left
"
>
Foto
</th>



<th
className="
p-3
text-left
"
>
NIK
</th>



<th
className="
p-3
text-left
"
>
Nama
</th>



<th
className="
p-3
text-left
"
>
Jabatan
</th>



<th
className="
p-3
text-left
"
>
Department
</th>



<th
className="
p-3
text-left
"
>
Telepon
</th>



<th
className="
p-3
text-left
"
>
Status
</th>



<th
className="
p-3
text-left
"
>
Aksi
</th>



</tr>


</thead>








<tbody>


{

loading ?


<tr>


<td

colSpan={8}

className="
p-6
text-center
"

>

Loading data...

</td>


</tr>





:

data.length===0 ?


<tr>


<td

colSpan={8}

className="
p-6
text-center
text-gray-500
"

>

Belum ada data karyawan

</td>


</tr>





:



data.map((e)=>(



<tr

key={e.id}

className="
border-t
hover:bg-gray-50
"

>




<td
className="
p-3
"
>


{

e.photo ?


<img

src={e.photo}

className="
w-12
h-12
rounded-full
object-cover
"

/>


:


<div

className="
w-12
h-12
rounded-full
bg-gray-200
flex
items-center
justify-center
"

>

👤

</div>


}



</td>








<td
className="
p-3
"
>

{e.nik}

</td>








<td>


<Link

href={`/employee/${e.id}`}

className="
text-blue-600
font-semibold
hover:underline
"

>

{e.name}

</Link>


</td>







<td>

{e.position}

</td>







<td>

{e.department || "-"}

</td>







<td>

{e.phone || "-"}

</td>








<td>


<span


className={`

px-3
py-1
rounded-full
text-sm

${
e.active

?

"bg-green-100 text-green-700"

:

"bg-red-100 text-red-700"

}

`}


>


{

e.active

?

"Aktif"

:

"Nonaktif"

}


</span>


</td>








<td>


<Link


href={`/employee/${e.id}`}


className="
bg-blue-600
text-white
px-3
py-2
rounded
text-sm
"

>

Detail

</Link>



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