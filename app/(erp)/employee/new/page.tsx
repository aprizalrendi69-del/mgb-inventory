"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewEmployeePage() {
  const router = useRouter();

  const [nik, setNik] = useState("");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");

  async function save() {
    if (!nik || !name || !position) {
      alert("Lengkapi data");
      return;
    }

    const res = await fetch("/api/employee", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nik,
        name,
        position,
      }),
    });

    const json = await res.json();

    if (json.success) {
      alert("Berhasil disimpan");
      router.push("/employee");
    } else {
      alert(json.message);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-8">

      <h1 className="text-3xl font-bold mb-6">
        Tambah Karyawan
      </h1>

      <div className="space-y-4">

        <input
          className="border w-full p-3 rounded"
          placeholder="NIK"
          value={nik}
          onChange={(e)=>setNik(e.target.value)}
        />

        <input
          className="border w-full p-3 rounded"
          placeholder="Nama Karyawan"
          value={name}
          onChange={(e)=>setName(e.target.value)}
        />


        <select
          className="border w-full p-3 rounded"
          value={position}
          onChange={(e)=>setPosition(e.target.value)}
        >

          <option value="">
            Pilih Role
          </option>

          <option value="ADMIN">
            ADMIN
          </option>

          <option value="MANAGER">
            MANAGER
          </option>

          <option value="PURCHASING">
            PURCHASING
          </option>

          <option value="GUDANG">
            GUDANG
          </option>

        </select>


        <button
          onClick={save}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded"
        >
          Simpan
        </button>

      </div>

    </div>
  );
}