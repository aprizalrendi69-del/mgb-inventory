"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function AttendanceDetailPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id;

  const [data, setData] = useState<any>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  async function loadData() {
    const res = await fetch(`/api/attendance/history/${id}`);
    const json = await res.json();

    if (json.success) {
      setData(json.data);
    }
  }

  if (!data) {
    return <div className="p-8">Loading...</div>;
  }

  const attendance = data.attendance.filter((item: any) => {
    const tanggal = new Date(item.checkIn)
      .toISOString()
      .split("T")[0];

    if (from && tanggal < from) return false;
    if (to && tanggal > to) return false;

    return true;
  });

  return (
    <div className="p-8">
      <button
        onClick={() => router.back()}
        className="mb-5 bg-gray-200 px-4 py-2 rounded"
      >
        ← Kembali
      </button>

      <div className="bg-white rounded shadow p-6 mb-6">
        <h1 className="text-3xl font-bold mb-4">
          Absensi {data.employee.name}
        </h1>

        <div className="mb-2">
          <b>NIK :</b> {data.employee.nik}
        </div>

        <div className="mb-2">
          <b>Jabatan :</b> {data.employee.position || "-"}
        </div>

        <div>
          <b>Total Kehadiran :</b> {attendance.length} Hari
        </div>
      </div>

      <div className="bg-white rounded shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">
          Filter Tanggal
        </h2>

        <div className="flex gap-4">
          <input
            type="date"
            className="border rounded p-2"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />

          <input
            type="date"
            className="border rounded p-2"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-3">Tanggal</th>
              <th className="border p-3">Check In</th>
              <th className="border p-3">Check Out</th>
              <th className="border p-3">Foto</th>
              <th className="border p-3">Catatan</th>
            </tr>
          </thead>

          <tbody>
            {attendance.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="border p-5 text-center"
                >
                  Belum ada data absensi
                </td>
              </tr>
            ) : (
              attendance.map((item: any) => (
                <tr key={item.id}>
                  <td className="border p-3">
                    {new Date(item.checkIn).toLocaleDateString(
                      "id-ID"
                    )}
                  </td>

                  <td className="border p-3">
                    {new Date(item.checkIn).toLocaleTimeString(
                      "id-ID"
                    )}
                  </td>

                  <td className="border p-3">
                    {item.checkOut
                      ? new Date(item.checkOut).toLocaleTimeString(
                          "id-ID"
                        )
                      : "-"}
                  </td>

                  <td className="border p-3">
                    {item.photo ? (
                      <img
                        src={item.photo}
                        alt="Foto Absensi"
                        className="w-16 h-16 object-cover rounded"
                      />
                    ) : (
                      "-"
                    )}
                  </td>

                  <td className="border p-3">
                    {item.note || "-"}
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