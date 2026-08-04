"use client";

import {
  useEffect,
  useRef,
  useState
} from "react";


export default function AttendancePage(){


  const [employees,setEmployees] =
  useState<any[]>([]);


  const [employeeId,setEmployeeId] =
  useState("");


  const [loading,setLoading] =
  useState(false);


  const [photo,setPhoto] =
  useState<File|null>(null);


  const [preview,setPreview] =
  useState("");



  const videoRef =
  useRef<HTMLVideoElement>(null);


  const canvasRef =
  useRef<HTMLCanvasElement>(null);


  const streamRef =
  useRef<MediaStream|null>(null);





  useEffect(()=>{

    loadEmployee();

    startCamera();


    return ()=>{

      stopCamera();

    };


  },[]);





  async function loadEmployee(){

    try{

      const res =
      await fetch("/api/employee");


      const json =
      await res.json();


      if(json.success){

        setEmployees(json.data);

      }


    }catch(err){

      console.log(err);

    }

  }







  async function startCamera(){


    try{


      const stream =
      await navigator.mediaDevices.getUserMedia({

        video:{
          facingMode:"user",
          width:720,
          height:720
        },

        audio:false

      });



      streamRef.current = stream;



      if(videoRef.current){

        videoRef.current.srcObject =
        stream;

      }



    }catch(err){

      console.log(err);

      alert(
        "Kamera tidak tersedia"
      );

    }


  }






  function stopCamera(){


    if(streamRef.current){


      streamRef.current
      .getTracks()
      .forEach(
        track=>track.stop()
      );


    }


  }








  function takePhoto(){


    const video =
    videoRef.current;


    const canvas =
    canvasRef.current;



    if(!video || !canvas){

      return;

    }




    canvas.width =
    video.videoWidth;


    canvas.height =
    video.videoHeight;




    const ctx =
    canvas.getContext("2d");



    ctx?.drawImage(

      video,

      0,

      0,

      canvas.width,

      canvas.height

    );






    canvas.toBlob(

      blob=>{


        if(!blob)
        return;



        const file =
        new File(

          [blob],

          `attendance-${Date.now()}.jpg`,

          {
            type:"image/jpeg"
          }

        );



        console.log(
          "FILE FOTO:",
          file
        );



        setPhoto(file);



        setPreview(
          URL.createObjectURL(blob)
        );



      },


      "image/jpeg",

      0.9


    );


  }









  async function uploadPhoto(){



    if(!photo){

      throw new Error(
        "Foto belum ada"
      );

    }




    const form =
    new FormData();



    form.append(
      "file",
      photo
    );





    const res =
    await fetch(

      "/api/upload/attendance",

      {

        method:"POST",

        body:form

      }

    );





    const json =
    await res.json();





    console.log(
      "UPLOAD RESULT:",
      json
    );






    if(!json.success){

      throw new Error(
        json.message ||
        "Upload gagal"
      );

    }






    const url =
    json.photo ||
    json.url;





    if(!url){

      throw new Error(
        "URL foto kosong"
      );

    }




    return url;



  }









  async function absen(
    type:"IN"|"OUT"
  ){



    if(!employeeId){

      alert(
        "Pilih pegawai dulu"
      );

      return;

    }




    if(!photo){

      alert(
        "Ambil foto selfie dulu"
      );

      return;

    }





    try{


      setLoading(true);




      const photoUrl =
      await uploadPhoto();





      console.log(
        "FOTO DIKIRIM:",
        photoUrl
      );






      const res =
      await fetch(

        "/api/attendance",

        {

          method:"POST",


          headers:{

            "Content-Type":
            "application/json"

          },


          body:JSON.stringify({

            employeeId:Number(employeeId),

            type:type,

            photo:photoUrl,

            note:""


          })


        }

      );







      const json =
      await res.json();




      console.log(
        "ABSEN:",
        json
      );




      alert(json.message);





      if(json.success){


        setEmployeeId("");

        setPhoto(null);

        setPreview("");


      }







    }catch(err:any){


      console.log(err);


      alert(
        err.message ||
        "Absensi gagal"
      );



    }finally{


      setLoading(false);


    }


  }









  return (

    <div className="p-8">


      <h1 className="text-3xl font-bold mb-6">
        Absensi Pegawai
      </h1>





      <div className="
      bg-white
      shadow
      rounded-lg
      p-6
      max-w-xl
      ">



      <label className="font-semibold">
        Pegawai
      </label>



      <select

        value={employeeId}

        onChange={(e)=>
          setEmployeeId(e.target.value)
        }

        className="
        border
        w-full
        p-3
        rounded
        mt-2
        mb-5
        "

      >


        <option value="">
          Pilih Pegawai
        </option>



        {
          employees.map(e=>(

            <option
              key={e.id}
              value={e.id}
            >

              {e.nik} - {e.name}

            </option>

          ))
        }


      </select>





      <video

        ref={videoRef}

        autoPlay

        playsInline

        className="
        w-full
        rounded
        border
        bg-black
        "

      />




      <canvas
        ref={canvasRef}
        className="hidden"
      />





      <button

        onClick={takePhoto}

        className="
        mt-4
        bg-blue-600
        text-white
        px-5
        py-3
        rounded
        "

      >

        📷 Ambil Selfie

      </button>






      {
        preview &&

        <img

          src={preview}

          className="
          mt-5
          rounded
          w-full
          "

        />

      }







      <div className="
      flex
      gap-4
      mt-6
      ">



      <button

        disabled={loading}

        onClick={()=>absen("IN")}

        className="
        bg-green-600
        text-white
        px-6
        py-3
        rounded
        "

      >

        {
          loading
          ?
          "Proses..."
          :
          "Check In"
        }


      </button>





      <button

        disabled={loading}

        onClick={()=>absen("OUT")}

        className="
        bg-red-600
        text-white
        px-6
        py-3
        rounded
        "

      >

        {
          loading
          ?
          "Proses..."
          :
          "Check Out"
        }


      </button>




      </div>




      </div>



    </div>

  );


}