"use client";

import { useEffect, useState } from "react";
import {
  Camera,
  MapPin,
  UserCheck,
  ClipboardList,
} from "lucide-react";

export default function AbsensiPage() {

  const [employee, setEmployee] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");

  const [location,setLocation] = useState({
    latitude:null,
    longitude:null
  });


  async function loadEmployee(){

    const res = await fetch("/api/employee");

    const json = await res.json();

    if(json.success){

      setEmployee(json.data);

    }

  }



  useEffect(()=>{

    loadEmployee();

    getLocation();

  },[]);



  function getLocation(){

    navigator.geolocation.getCurrentPosition(

      (position)=>{

        setLocation({

          latitude:position.coords.latitude,

          longitude:position.coords.longitude

        });

      },

      ()=>{

        alert(
          "GPS tidak aktif atau izin lokasi ditolak"
        );

      },

      {
        enableHighAccuracy:true,
        timeout:10000,
        maximumAge:0
      }

    );

  }



  async function uploadPhoto(e:any){

    const file=e.target.files[0];

    if(!file)return;


    const form=new FormData();

    form.append(
      "file",
      file
    );


    const res=await fetch(
      "/api/upload/attendance",
      {
        method:"POST",
        body:form
      }
    );


    const json=await res.json();


    if(json.success){

      setPhoto(json.photo);

    }else{

      alert(json.message);

    }

  }



  async function checkIn(){

    if(!employeeId){

      alert(
        "Pilih karyawan"
      );

      return;

    }


    if(
      !location.latitude ||
      !location.longitude
    ){

      alert(
        "Lokasi GPS belum terbaca"
      );

      getLocation();

      return;

    }



    const res=await fetch(
      "/api/attendance",
      {

        method:"POST",

        headers:{
          "Content-Type":"application/json"
        },

        body:JSON.stringify({

          employeeId:Number(employeeId),

          photo,

          note,

          latitude:location.latitude,

          longitude:location.longitude

        })

      }
    );



    const json=await res.json();


    alert(json.message);


    if(json.success){

      setEmployeeId("");

      setPhoto("");

      setNote("");

    }

  }



return (

<div className="space-y-6 p-6 md:p-8">


{/* HEADER */}

<div>

<h1 className="
text-3xl
font-bold
text-[#29483A]
">

Absensi Karyawan

</h1>


<p className="
mt-2
text-sm
text-[#71827A]
">

Kelola absensi karyawan dengan foto dan lokasi

</p>


</div>





<div className="
grid
grid-cols-1
xl:grid-cols-3
gap-6
">



{/* FORM */}

<div className="
xl:col-span-2
rounded-2xl
border
border-[#D5E5DC]
bg-[#F9FCFA]
p-6
shadow-[0_4px_20px_rgba(73,127,112,0.05)]
">


<div className="
flex
items-center
gap-3
mb-6
">


<div className="
h-10
w-10
rounded-xl
bg-[#E8F3EC]
flex
items-center
justify-center
">

<UserCheck
size={20}
className="text-[#497F70]"
/>

</div>


<div>

<h2 className="
font-bold
text-[#29483A]
">

Form Check In

</h2>


<p className="
text-xs
text-[#71827A]
">

Input data kehadiran

</p>


</div>


</div>





<label className="
text-sm
font-medium
text-[#40584C]
">

Karyawan

</label>


<select

value={employeeId}

onChange={(e)=>setEmployeeId(e.target.value)}

className="
mt-2
w-full
rounded-xl
border
border-[#D5E5DC]
bg-white
p-3
outline-none
focus:border-[#497F70]
"

>


<option value="">

-- Pilih Karyawan --

</option>


{

employee.map((item:any)=>(

<option

key={item.id}

value={item.id}

>

{item.nik} - {item.name}

</option>

))

}


</select>





<div className="mt-5">


<label className="
text-sm
font-medium
text-[#40584C]
">

Foto Absensi

</label>


<div className="
mt-2
rounded-xl
border
border-dashed
border-[#BFD8CA]
bg-[#EAF4EE]
p-5
">

<div className="
flex
items-center
gap-3
mb-3
text-[#497F70]
">

<Camera size={18}/>

<span className="text-sm">

Ambil foto selfie

</span>


</div>


<input

type="file"

accept="image/*"

capture="environment"

onChange={uploadPhoto}

className="
w-full
text-sm
"

 />

</div>


</div>




{
photo &&

<div className="mt-5">

<img

src={photo}

className="
w-48
rounded-xl
border
border-[#D5E5DC]
"

/>

</div>

}




<div className="mt-5">


<label className="
text-sm
font-medium
text-[#40584C]
">

Keterangan

</label>


<textarea

value={note}

onChange={(e)=>setNote(e.target.value)}

className="
mt-2
w-full
rounded-xl
border
border-[#D5E5DC]
p-3
h-28
outline-none
focus:border-[#497F70]
"

/>


</div>





<button

onClick={checkIn}

className="
mt-6
rounded-xl
bg-[#497F70]
px-6
py-3
font-semibold
text-white
transition
hover:bg-[#386657]
"

>

Check In

</button>



</div>






{/* INFO */}

<div className="
rounded-2xl
border
border-[#D5E5DC]
bg-[#E8F3EC]
p-6
">


<div className="
flex
items-center
gap-3
mb-5
">

<MapPin
size={22}
className="text-[#497F70]"
/>


<h2 className="
font-bold
text-[#29483A]
">

Status Lokasi

</h2>


</div>




<div className="
rounded-xl
bg-white
p-4
border
border-[#D5E5DC]
">


<p className="
text-xs
text-[#71827A]
">

Latitude

</p>


<p className="
font-semibold
text-[#29483A]
">

{location.latitude ?? "-"}

</p>


</div>




<div className="
mt-3
rounded-xl
bg-white
p-4
border
border-[#D5E5DC]
">


<p className="
text-xs
text-[#71827A]
">

Longitude

</p>


<p className="
font-semibold
text-[#29483A]
">

{location.longitude ?? "-"}

</p>


</div>




<div className="
mt-5
rounded-xl
bg-[#F9FCFA]
p-4
">


<div className="
flex
items-center
gap-2
text-[#497F70]
">

<ClipboardList size={18}/>

<span className="text-sm font-semibold">

Catatan

</span>

</div>


<p className="
mt-2
text-xs
text-[#71827A]
">

Pastikan kamera dan lokasi aktif sebelum melakukan check in.

</p>


</div>


</div>



</div>


</div>


);

}