"use client";

import {useRouter,useParams} from "next/navigation";
import {useEffect,useState} from "react";


export default function ReceivePage(){

const router=useRouter();
const params=useParams();


const [items,setItems]=useState<any[]>([]);



useEffect(()=>{

load();

},[]);



async function load(){

const res=await fetch(
"/api/purchase/"+params.id
);

const json=await res.json();



if(json.success){

setItems(

json.data.items.map((x:any)=>({

barangId:x.barangId,

name:x.barang.name,

qty:x.qty,

price:x.price,

hasExpired:x.barang.hasExpired,

expiredDate:""

}))

);


}

}




function updateExpired(
index:number,
value:string
){

const temp=[...items];

temp[index].expiredDate=value;

setItems(temp);

}




async function receive(){



// VALIDASI EXPIRED

for(const item of items){


if(
item.hasExpired &&
!item.expiredDate
){

alert(
`Barang ${item.name} wajib isi expired date`
);

return;

}


}




const res=await fetch(

"/api/purchase/"+params.id+"/receive",

{

method:"PUT",

headers:{
"Content-Type":"application/json"
},


body:JSON.stringify({

items

})

}

);



const json=await res.json();



if(json.success){

alert("Barang diterima");

router.push("/barang-masuk");


}else{

alert(json.message);

}


}





return(

<div className="p-8">


<h1 className="text-3xl font-bold mb-5">
Receive Barang
</h1>



<table className="border w-full">


<thead>

<tr>

<th className="border p-2">
Barang
</th>


<th className="border p-2">
Qty
</th>


<th className="border p-2">
Expired Date
</th>


</tr>

</thead>



<tbody>


{

items.map((item,index)=>(


<tr key={index}>


<td className="border p-2">

{item.name}

</td>



<td className="border p-2">

{item.qty}

</td>



<td className="border p-2">



{

item.hasExpired ?


<input

type="date"

className="border p-2"

value={item.expiredDate}

onChange={(e)=>

updateExpired(
index,
e.target.value
)

}

/>


:

<span className="text-gray-400">

Tidak menggunakan expired

</span>


}



</td>



</tr>


))

}



</tbody>


</table>




<button

onClick={receive}

className="mt-5 bg-green-600 text-white px-6 py-2 rounded"

>

Terima Barang

</button>



</div>

)

}