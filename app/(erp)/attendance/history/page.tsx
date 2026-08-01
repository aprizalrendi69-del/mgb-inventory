"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AttendanceHistoryPage() {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const res = await fetch("/api/attendance/history");
    const json = await res.json();

    if (json.success) {
      setData(json.data);
    }
  }

  const filtered = data.filter((item: any) => {
    const text = (
      (item.fullname || "") +
      (item.nik || "") +
      (item.role || "")
    ).toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">
        History Absensi Karyawan
      </h1>

      <input
        className="border rounded p-3 w-full mb-6"
        placeholder="Cari Nama / NIK / Jabatan..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="bg-white rounded-lg shadow overflow-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-3 text-left">Nama</th>
              <th className="border p-3 text-left">NIK</th>
              <th className="border p-3 text-left">Jabatan</th>
              <th className="border p-3 text-left">Total Hadir</th>
              <th className="border p-3 text-left">Total Absen</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="border p-5 text-center">
                  Belum ada data karyawan
                </td>
              </tr>
            ) : (
              filtered.map((item: any) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50"
                >
                  <td className="border p-3">
                    <Link
                      href={`/attendance/history/${item.id}`}
                      className="text-blue-600 font-semibold"
                    >
                      {item.fullname}
                    </Link>
                  </td>

                  <td className="border p-3">
                    {item.nik}
                  </td>

                  <td className="border p-3">
                    {item.role}
                  </td>

                  <td className="border p-3">
                    {item.totalHadir}
                  </td>

                  <td className="border p-3">
                    {item.totalAbsen}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}