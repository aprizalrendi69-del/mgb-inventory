"use client";

import { useEffect, useState } from "react";

export default function AttendancePage() {

  const [employees, setEmployees] = useState<any[]>([]);

  const [employeeId, setEmployeeId] = useState("");

  const [photo, setPhoto] = useState<File | null>(null);

  const [latitude, setLatitude] = useState<number>(0);

  const [longitude, setLongitude] = useState<number>(0);

  const [loading, setLoading] = useState(false);



  useEffect(() => {

    loadEmployee();

    getLocation();

  }, []);




  async function loadEmployee(){

    try{

      const res = await fetch("/api/employee");

      const json = await res.json();


      if(json.success){

        setEmployees(json.data);

      }


    }catch(error){

      console.error(error);

    }

  }





  function getLocation(){

    if(!navigator.geolocation){

      return;

    }


    navigator.geolocation.getCurrentPosition(

      (pos)=>{

        setLatitude(pos.coords.latitude);

        setLongitude(pos.coords.longitude);

      },


      ()=>{

        alert("GPS tidak aktif");

      }

    );

  }







  async function absen(type:"IN"|"OUT"){


    if(!employeeId){

      alert("Pilih pegawai");

      return;

    }



    if(!photo){

      alert("Foto selfie wajib");

      return;

    }




    setLoading(true);



    try{


      // upload foto

      const form = new FormData();

      form.append(
        "file",
        photo
      );



      const upload = await fetch(

        "/api/upload/attendance",

        {

          method:"POST",

          body:form

        }

      );



      const img = await upload.json();




      if(!upload.ok){

        throw new Error(
          "Upload foto gagal"
        );

      }




      const res = await fetch(

        "/api/attendance",

        {

          method:"POST",


          headers:{

            "Content-Type":"application/json"

          },


          body:JSON.stringify({

            employeeId:Number(employeeId),

            type,


            latitude,

            longitude,


            photo:
              img.url ??
              img.photo ??
              null


          })

        }

      );





      const json = await res.json();



      alert(json.message);




      if(json.success){


        setEmployeeId("");

        setPhoto(null);


      }



    }catch(error){


      console.error(error);

      alert("Terjadi kesalahan");



    }finally{


      setLoading(false);


    }


  }






  return (

    <div className="p-8">


      <h1 className="text-3xl font-bold mb-6">

        Absensi Pegawai

      </h1>




      <div className="bg-white rounded-lg shadow p-6 max-w-xl">



        <label className="block mb-2">

          Pegawai

        </label>



        <select

          className="border w-full p-3 rounded mb-4"

          value={employeeId}

          onChange={(e)=>
            setEmployeeId(e.target.value)
          }

        >


          <option value="">

            Pilih Pegawai

          </option>



          {employees.map((e:any)=>(

            <option

              key={e.id}

              value={e.id}

            >

              {e.nik} - {e.name}

            </option>


          ))}



        </select>





        <label className="block mb-2">

          Selfie

        </label>



        <input


          type="file"


          accept="image/*"


          capture="user"


          className="border w-full p-3 rounded mb-4"



          onChange={(e)=>{


            if(e.target.files?.length){

              setPhoto(
                e.target.files[0]
              );

            }


          }}


        />






        <div className="mb-6">


          <p>

            Latitude : {latitude}

          </p>


          <p>

            Longitude : {longitude}

          </p>


        </div>







        <div className="flex gap-4">


          <button


            disabled={loading}


            onClick={()=>
              absen("IN")
            }


            className="bg-green-600 text-white px-6 py-3 rounded"

          >

            {loading ? "Proses..." : "Check In"}


          </button>







          <button


            disabled={loading}


            onClick={()=>
              absen("OUT")
            }


            className="bg-red-600 text-white px-6 py-3 rounded"


          >

            {loading ? "Proses..." : "Check Out"}


          </button>



        </div>



      </div>



    </div>

  );

}