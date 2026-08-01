"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";


export default function EditSupplierPage(){

const router = useRouter();

const params = useParams();

const id = params.id;



const [form,setForm]=useState({

name:"",
phone:"",
address:""

});



useEffect(()=>{

loadSupplier();

},[]);



async function loadSupplier(){

const res = await fetch(
`/api/supplier/${id}`
);


const data = await res.json();


setForm({

name:data.name || "",

phone:data.phone || "",

address:data.address || ""

});


}




function change(
e:React.ChangeEvent<HTMLInputElement>
){

setForm({

...form,

[e.target.name]:
e.target.value

});

}





async function save(){

const res =
await fetch(
`/api/supplier/${id}`,
{

method:"PUT",

headers:{
"Content-Type":"application/json"
},

body:
JSON.stringify(form)

});


if(res.ok){

alert(
"Supplier berhasil diperbarui"
);


router.push(
"/supplier"
);


}

}




return (

<div className="p-6">


<h1 className="text-xl font-bold mb-5">
Edit Supplier
</h1>



<div className="space-y-3">


<input

className="border p-2 w-full"

name="name"

value={form.name}

onChange={change}

placeholder="Nama Supplier"

/>



<input

className="border p-2 w-full"

name="phone"

value={form.phone}

onChange={change}

placeholder="Telepon"

/>



<input

className="border p-2 w-full"

name="address"

value={form.address}

onChange={change}

placeholder="Alamat"

/>



<button

onClick={save}

className="bg-blue-600 text-white px-4 py-2 rounded"

>

Simpan

</button>


</div>


</div>

);


}