"use client";

import {useEffect,useState} from "react";

export default function UserPage(){

const [data,setData]=useState([]);

const [form,setForm]=useState({

username:"",

fullname:"",

password:"",

role:"ADMIN"

});

async function load(){

const res=await fetch("/api/user");

const json=await res.json();

setData(json.data);

}

useEffect(()=>{

load();

},[]);

async function simpan(){

const res = await fetch("/api/user",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify(form)

});


const json = await res.json();


if(json.success){

alert("User berhasil dibuat");


load();


setForm({

username:"",
fullname:"",
password:"",
role:"ADMIN"

});


}else{


alert(json.message);


}

}

return(

<div className="p-8">

<h1 className="text-3xl font-bold">

Master User

</h1>

<div className="grid grid-cols-4 gap-3 mt-5">

<input

className="border p-2"

placeholder="Username"

value={form.username}

onChange={e=>setForm({

...form,

username:e.target.value

})}

/>

<input

className="border p-2"

placeholder="Nama"

value={form.fullname}

onChange={e=>setForm({

...form,

fullname:e.target.value

})}

/>

<input

type="password"

className="border p-2"

placeholder="Password"

value={form.password}

onChange={e=>setForm({

...form,

password:e.target.value

})}

/>

<select

className="border p-2"

value={form.role}

onChange={e=>setForm({

...form,

role:e.target.value

})}

>

<option>ADMIN</option>

<option>MANAGER</option>

<option>PURCHASING</option>

<option>GUDANG</option>

</select>

</div>

<button

onClick={simpan}

className="bg-blue-600 text-white px-5 py-2 rounded mt-4"

>

Simpan

</button>

<table className="w-full mt-8 border">

<thead>

<tr className="bg-gray-200">

<th>No</th>

<th>Username</th>

<th>Nama</th>

<th>Role</th>

</tr>

</thead>

<tbody>

{data.map((u:any,i)=>(

<tr key={u.id}>

<td>{i+1}</td>

<td>{u.username}</td>

<td>{u.fullname}</td>

<td>{u.role}</td>

</tr>

))}

</tbody>

</table>

</div>

)

}