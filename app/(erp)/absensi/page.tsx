"use client";

import { useEffect, useState } from "react";

export default function AbsensiPage() {

  const [employee, setEmployee] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const [location,setLocation] = useState({
  latitude:null,
  longitude:null
});

  async function loadEmployee() {

    const res = await fetch("/api/employee");

    const json = await res.json();

    if (json.success) {

      setEmployee(json.data);

    }

  }

  useEffect(() => {

  loadEmployee();

  getLocation();

}, []);

    function getLocation(){

    navigator.geolocation.getCurrentPosition(

      (position)=>{

        setLocation({

          latitude: position.coords.latitude,

          longitude: position.coords.longitude

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

  async function uploadPhoto(e: any) {

    const file = e.target.files[0];

    if (!file) return;

    const form = new FormData();

    form.append("file", file);

    const res = await fetch("/api/upload/attendance", {

      method: "POST",

      body: form

    });

    const json = await res.json();

    if (json.success) {

      setPhoto(json.photo);

    } else {

      alert(json.message);

    }

  }

  async function checkIn() {


  if (!employeeId) {

    alert("Pilih karyawan");

    return;

  }


  if (
    !location.latitude ||
    !location.longitude
  ){

    alert(
      "Lokasi GPS belum terbaca. Aktifkan GPS dan izinkan lokasi."
    );

    getLocation();

    return;

  }


  const res = await fetch("/api/attendance", {

      method: "POST",

      headers: {

        "Content-Type": "application/json"

      },

      body: JSON.stringify({

  employeeId: Number(employeeId),

  photo,

  note,

  latitude: location.latitude,

  longitude: location.longitude

})

    });

    const json = await res.json();

    alert(json.message);

    if (json.success) {

      setEmployeeId("");
      setPhoto("");
      setNote("");

    }

  }

  return (

    <div className="p-8">

      <h1 className="text-3xl font-bold mb-6">

        Absensi Karyawan

      </h1>

      <div className="bg-white shadow rounded-xl p-6">

        <div className="mb-4">

          <label>Karyawan</label>

          <select

            className="border w-full p-3 rounded"

            value={employeeId}

            onChange={(e) => setEmployeeId(e.target.value)}

          >

            <option value="">

              -- Pilih Karyawan --

            </option>

            {

              employee.map((item: any) => (

                <option

                  key={item.id}

                  value={item.id}

                >

                  {item.nik} - {item.name}

                </option>

              ))

            }

          </select>

        </div>

        <div className="mb-4">

          <label>Foto Absensi</label>

          <input

            type="file"

            accept="image/*"

            capture="environment"

            onChange={uploadPhoto}

            className="border w-full p-2 rounded"

          />

        </div>

        {

          photo && (

            <img

              src={photo}

              className="w-40 rounded-lg border mb-4"

            />

          )

        }

        <div className="mb-4">

          <label>Keterangan</label>

          <textarea

            className="border w-full p-3 rounded"

            value={note}

            onChange={(e) => setNote(e.target.value)}

          />

        </div>

        <button

          onClick={checkIn}

          className="bg-blue-600 text-white px-6 py-3 rounded"

        >

          Check In

        </button>

      </div>

    </div>

  );

}