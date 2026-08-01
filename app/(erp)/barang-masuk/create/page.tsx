"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";


export default function CreateBarangMasuk(){

const searchParams = useSearchParams();
const router = useRouter();

const purchaseId = searchParams.get("purchaseId");


const [purchase,setPurchase]=useState<any>(null);
const [qty,setQty]=useState<any>({});
const [loading,setLoading]=useState(true);



async function loadPurchase(){

if(!purchaseId) return;

const res = await fetch(
`/api/purchase/${purchaseId}`
);

const json = await res.json();


if(json.success){

setPurchase(json.data);


const temp:any={};


json.data.items.forEach((item:any)=>{

temp[item.id]=item.qty;

});


setQty(temp);

}


setLoading(false);

}



useEffect(()=>{

loadPurchase();

},[]);





async function saveReceive(){


const items = Object.keys(qty).map(id=>({

itemId:Number(id),
qty:Number(qty[id])

}));



const res = await fetch(
"/api/barang-masuk",
{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

purchaseId:Number(purchaseId),
items

})

});


const json = await res.json();



if(json.success){

alert("Barang berhasil diterima");

router.push("/barang-masuk");

}else{

alert(json.message);

}


}





if(loading){

return <div className="p-8">
Loading...
</div>

}



if(!purchase){

return <div className="p-8">
Purchase tidak ditemukan
</div>

}




return (

<div className="p-8">


<h1 className="text-3xl font-bold mb-5">
Receive Barang
</h1>


<div className="bg-white border rounded-xl p-5 mb-5">


<h2 className="font-bold text-lg">
Purchase Order
</h2>


<p>
Nomor : {purchase.number}
</p>


<p>
Supplier : {purchase.supplier?.name}
</p>


</div>




<table className="w-full border bg-white">


<thead>

<tr className="bg-blue-700 text-white">

<th className="border p-2">
No
</th>


<th className="border p-2">
Barang
</th>


<th className="border p-2">
Qty Order
</th>


<th className="border p-2">
Qty Terima
</th>


</tr>

</thead>



<tbody>


{
purchase.items.map(
(item:any,index:number)=>(

<tr key={item.id}>


<td className="border p-2 text-center">
{index+1}
</td>


<td className="border p-2">
{item.barang?.name}
</td>



<td className="border p-2 text-center">
{item.qty}
</td>



<td className="border p-2">

<input

type="number"

className="border rounded p-2 w-full"

value={qty[item.id] || ""}

onChange={(e)=>

setQty({

...qty,

[item.id]:e.target.value

})

}

/>

</td>



</tr>

)

)

}


</tbody>


</table>



<div className="mt-5 flex justify-end">


<button

onClick={saveReceive}

className="bg-green-600 text-white px-5 py-3 rounded-lg"

>

Simpan Barang Masuk

</button>


</div>



</div>

)

}