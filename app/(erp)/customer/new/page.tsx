"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCustomer() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    code: "",
    name: "",
    address: "",
    city: "",
    phone: "",
    email: "",
    pic: "",
  });

  async function simpan() {
    if (!form.code || !form.name) {
      alert("Kode dan Nama Customer wajib diisi");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        alert(result.message || "Gagal menyimpan customer");
        return;
      }

      alert("Customer berhasil disimpan");

      router.push("/customer");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-3xl font-bold mb-6">
        Customer Baru
      </h1>

      <div className="space-y-3">

        <input
          className="border p-2 w-full"
          placeholder="Kode"
          value={form.code}
          onChange={(e) =>
            setForm({ ...form, code: e.target.value })
          }
        />

        <input
          className="border p-2 w-full"
          placeholder="Nama"
          value={form.name}
          onChange={(e) =>
            setForm({ ...form, name: e.target.value })
          }
        />

        <textarea
          className="border p-2 w-full"
          placeholder="Alamat"
          value={form.address}
          onChange={(e) =>
            setForm({ ...form, address: e.target.value })
          }
        />

        <input
          className="border p-2 w-full"
          placeholder="Kota"
          value={form.city}
          onChange={(e) =>
            setForm({ ...form, city: e.target.value })
          }
        />

        <input
          className="border p-2 w-full"
          placeholder="PIC"
          value={form.pic}
          onChange={(e) =>
            setForm({ ...form, pic: e.target.value })
          }
        />

        <input
          className="border p-2 w-full"
          placeholder="Telepon"
          value={form.phone}
          onChange={(e) =>
            setForm({ ...form, phone: e.target.value })
          }
        />

        <input
          className="border p-2 w-full"
          placeholder="Email"
          value={form.email}
          onChange={(e) =>
            setForm({ ...form, email: e.target.value })
          }
        />

        <button
          onClick={simpan}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded disabled:bg-gray-400"
        >
          {loading ? "Menyimpan..." : "Simpan"}
        </button>

      </div>
    </div>
  );
}