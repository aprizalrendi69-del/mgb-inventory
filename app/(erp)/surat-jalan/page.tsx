"use client";

import Link from "next/link";
import { useEffect, useState } from "react";


export default function SuratJalanPage(){

  const [data,setData] = useState<any[]>([]);
  const [loading,setLoading] = useState(true);



  async function loadData(){

    try{

      const res = await fetch("/api/delivery");

      const json = await res.json();


      const result =
        Array.isArray(json)
        ?
        json
        :
        json.data || [];


      setData(result);


    }catch(err){

      console.error(err);

      setData([]);

    }
    finally{

      setLoading(false);

    }

  }





  useEffect(()=>{

    loadData();

  },[]);







  return (

<div className="p-8">


<h1 className="text-3xl font-bold mb-6">
Surat Jalan
</h1>





<div className="
bg-white
rounded-xl
shadow
overflow-hidden
">


<table className="w-full">


<thead className="bg-gray-100">


<tr>


<th className="p-3 text-left">
No DO
</th>


<th className="p-3 text-left">
Tanggal
</th>


<th className="p-3 text-left">
Customer
</th>


<th className="p-3 text-center">
Status
</th>


<th className="p-3 text-center">
Aksi
</th>


</tr>


</thead>





<tbody>



{

loading ?


<tr>

<td

colSpan={5}

className="
p-6
text-center
"

>

Loading...

</td>

</tr>




:


data.length===0 ?



<tr>

<td

colSpan={5}

className="
p-6
text-center
"

>

Belum ada data

</td>

</tr>




:



data.map((item:any)=>(


<tr

key={item.id}

className="border-t"

>



<td className="p-3">

{item.number}

</td>





<td className="p-3">

{

new Date(
item.deliveryDate
)
.toLocaleDateString("id-ID")

}

</td>






<td className="p-3">

{item.customer?.name}

</td>





<td className="p-3 text-center">

{item.status}

</td>





<td className="p-3">


<div className="
flex
justify-center
">


<Link


href={`/surat-jalan/${item.id}`}


className="
bg-blue-600
text-white
px-4
py-2
rounded
"


>

Detail

</Link>



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