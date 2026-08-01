"use client";

import {
useEffect,
useState
} from "react";


export default function StockOpnamePage(){


const [history,setHistory]=useState<any[]>([]);

const [barang,setBarang]=useState<any[]>([]);

const [physical,setPhysical]=useState<any>({});

const [loading,setLoading]=useState(false);

const [adjustLoading,setAdjustLoading]=useState<number|null>(null);



async function load(){


const opname =
await fetch("/api/stock-opname");


const opnameResult =
await opname.json();


if(opnameResult.success){

setHistory(opnameResult.data);

}



const brg =
await fetch("/api/barang");


const brgResult =
await brg.json();



if(brgResult.success){

setBarang(brgResult.data);

}


}



useEffect(()=>{

load();

},[]);





function changeQty(
id:number,
value:string
){

setPhysical({

...physical,

[id]:Number(value)

});

}





async function simpan(){


const items =
barang.map((b:any)=>({

barangId:b.id,

physicalQty:
physical[b.id] ?? b.stock

}));



setLoading(true);



const res =
await fetch(
"/api/stock-opname",
{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

items

})

}

);



const result =
await res.json();



setLoading(false);



if(result.success){

alert(
"Stock Opname berhasil disimpan"
);


setPhysical({});


load();


}

else{

alert(result.message);

}


}





async function buatAdjustment(
id:number
){


setAdjustLoading(id);



const res =
await fetch(

`/api/stock-opname/${id}/adjustment`,

{
method:"POST"
}

);



const result =
await res.json();



setAdjustLoading(null);



if(result.success){

alert(
"Adjustment berhasil dibuat"
);

load();

}

else{

alert(result.message);

}


}






return (

<div className="p-6">


<div className="bg-white rounded-xl shadow p-6">



<h1 className="text-2xl font-bold mb-6">

Stock Opname

</h1>




<h2 className="font-bold mb-3">

Input Stock Opname Baru

</h2>



<table className="w-full border mb-5">


<thead>

<tr className="bg-gray-100">


<th className="border p-2">
No
</th>


<th className="border p-2">
Barang
</th>


<th className="border p-2">
Stock Sistem
</th>


<th className="border p-2">
Stock Fisik
</th>


<th className="border p-2">
Selisih
</th>


</tr>

</thead>



<tbody>


{
barang.map(
(b:any,index:number)=>(


<tr key={b.id}>


<td className="border p-2 text-center">
{index+1}
</td>



<td className="border p-2">
{b.name}
</td>



<td className="border p-2 text-center">
{b.stock}
</td>



<td className="border p-2">


<input

type="number"

className="border rounded p-1 w-24"

value={
physical[b.id] ?? b.stock
}


onChange={(e)=>
changeQty(
b.id,
e.target.value
)
}


/>


</td>



<td className="border p-2 text-center">


{
(
physical[b.id] ?? b.stock
)
-
b.stock
}


</td>



</tr>


)

)


}


</tbody>


</table>




<button

onClick={simpan}

disabled={loading}

className="
bg-blue-600
text-white
px-5
py-2
rounded
"

>


{
loading
?
"Menyimpan..."
:
"Simpan Stock Opname"
}


</button>





<hr className="my-8"/>




<h2 className="text-xl font-bold mb-4">

History Stock Opname

</h2>






{
history.map(
(opname:any)=>(



<div

key={opname.id}

className="
border
rounded-lg
p-5
mb-5
"

>



<div className="flex gap-2 mb-5 flex-wrap">



<a

href={`/stock-opname/print?id=${opname.id}`}

target="_blank"

className="
bg-gray-700
text-white
px-4
py-2
rounded
"

>

Print

</a>




<a

href={`/api/stock-opname/export/pdf?id=${opname.id}`}

className="
bg-red-600
text-white
px-4
py-2
rounded
"

>

Export PDF

</a>




<a

href={`/api/stock-opname/export/excel?id=${opname.id}`}

className="
bg-green-600
text-white
px-4
py-2
rounded
"

>

Export Excel

</a>





<button

onClick={()=>
buatAdjustment(opname.id)
}

disabled={
adjustLoading===opname.id
}


className="
bg-orange-600
text-white
px-4
py-2
rounded
"

>


{
adjustLoading===opname.id
?
"Proses..."
:
"Buat Adjustment"
}


</button>



</div>






<div className="grid grid-cols-4 mb-4">


<div>

<b>Nomor</b>

<br/>

{opname.number}

</div>



<div>

<b>Tanggal</b>

<br/>

{
new Date(
opname.opnameDate
)
.toLocaleDateString("id-ID")
}

</div>




<div>

<b>Status</b>

<br/>

{opname.status}

</div>




<div>

<b>Warehouse</b>

<br/>

{opname.warehouse}

</div>



</div>







<table className="w-full border">


<thead>

<tr className="bg-gray-100">


<th className="border p-2">
Barang
</th>


<th className="border p-2">
Sistem
</th>


<th className="border p-2">
Fisik
</th>


<th className="border p-2">
Selisih
</th>


</tr>


</thead>




<tbody>


{
opname.items?.map(
(item:any)=>(


<tr key={item.id}>


<td className="border p-2">

{item.barang?.name}

</td>



<td className="border p-2 text-center">

{item.systemQty}

</td>



<td className="border p-2 text-center">

{item.physicalQty}

</td>



<td className="border p-2 text-center">

{item.difference}

</td>



</tr>


)

)

}



</tbody>


</table>



</div>



)

)

}



</div>


</div>

)


}