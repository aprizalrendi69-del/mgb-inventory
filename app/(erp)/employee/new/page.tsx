"use client";

import {
  useState
} from "react";

import {
  useRouter
} from "next/navigation";


export default function EmployeeNewPage(){


const router = useRouter();


const [form,setForm] = useState({

  nik:"",
  name:"",
  gender:"",
  position:"",
  department:"",
  phone:"",
  address:""

});


const [loading,setLoading] =
useState(false);





function change(
e:any
){

setForm({

...form,

[e.target.name]:
e.target.value

});

}





async function save(){


try{


setLoading(true);



const res =
await fetch(
"/api/employee",
{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify(form)

}

);



const json =
await res.json();



alert(json.message);



if(json.success){

router.push("/employee");

router.refresh();

}



}catch(error){

console.log(error);

alert("Gagal simpan");


}finally{

setLoading(false);

}


}





return (

<div className="p-8">


<h1 className="
text-3xl
font-bold
mb-6
">

Tambah Karyawan

</h1>




<div className="
bg-white
shadow
rounded-lg
p-6
max-w-xl
">





<label>
NIK
</label>

<input

name="nik"

value={form.nik}

onChange={change}

className="
border
w-full
p-3
rounded
mb-4
"

/>







<label>
Nama Karyawan
</label>

<input

name="name"

value={form.name}

onChange={change}

className="
border
w-full
p-3
rounded
mb-4
"

/>







<label>
Jenis Kelamin
</label>


<select

name="gender"

value={form.gender}

onChange={change}

className="
border
w-full
p-3
rounded
mb-4
"

>


<option value="">
Pilih
</option>


<option value="L">
Laki-laki
</option>


<option value="P">
Perempuan
</option>


</select>







<label>
Jabatan
</label>


<input

name="position"

value={form.position}

onChange={change}

className="
border
w-full
p-3
rounded
mb-4
"

/>







<label>
Department
</label>


<input

name="department"

value={form.department}

onChange={change}

className="
border
w-full
p-3
rounded
mb-4
"

/>







<label>
Nomor HP
</label>


<input

name="phone"

value={form.phone}

onChange={change}

className="
border
w-full
p-3
rounded
mb-4
"

/>







<label>
Alamat
</label>


<textarea

name="address"

value={form.address}

onChange={change}

className="
border
w-full
p-3
rounded
mb-4
"

/>








<button


disabled={loading}


onClick={save}


className="
bg-blue-600
text-white
px-6
py-3
rounded-lg
"


>


{
loading
?
"Menyimpan..."
:
"Simpan Karyawan"
}


</button>




</div>


</div>


);


}