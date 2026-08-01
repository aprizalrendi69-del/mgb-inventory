"use client";

import { useEffect, useState } from "react";

export default function PengirimanPage() {
  const [delivery, setDelivery] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const res = await fetch("/api/delivery-order");
      const json = await res.json();

      setDelivery(
        Array.isArray(json.data)
          ? json.data
          : []
      );
    } catch (error) {
      console.error(error);
      setDelivery([]);
    }
  }

  async function approve(id: number) {
    if (!confirm("Release Delivery Order ini?")) return;

    setLoading(true);

    const res = await fetch(
      `/api/delivery-order/${id}/approve`,
      {
        method: "PUT",
      }
    );

    const json = await res.json();

    setLoading(false);

    if (json.success) {
      alert(json.message);
      loadData();
    } else {
      alert(json.message);
    }
  }

  return (
    <div className="p-8">

      <h1 className="text-3xl font-bold mb-6">
        Delivery Order
      </h1>

      <div className="bg-white rounded-xl shadow overflow-hidden">

        <table className="w-full">

          <thead className="bg-gray-100">

            <tr>

              <th className="p-3 text-left">Nomor</th>

              <th className="p-3 text-left">Tanggal</th>

              <th className="p-3 text-left">Customer</th>

              <th className="p-3 text-center">Qty</th>

              <th className="p-3 text-center">Status</th>

              <th className="p-3 text-center">Action</th>

            </tr>

          </thead>

          <tbody>

            {delivery.map((d: any) => (

              <tr
                key={d.id}
                className="border-t"
              >

                <td className="p-3">
                  {d.number}
                </td>

                <td className="p-3">
                  {new Date(d.deliveryDate)
                    .toLocaleDateString("id-ID")}
                </td>

                <td className="p-3">
                  {d.customer?.name}
                </td>

                <td className="p-3 text-center">
                  {d.totalQty}
                </td>

                <td className="p-3 text-center">

                  {d.status}

                </td>

                <td className="p-3 text-center">

                  {d.status === "DRAFT" ? (

  <button
    disabled={loading}
    onClick={() => approve(d.id)}
    className="bg-blue-600 text-white px-4 py-2 rounded"
  >
    Release
  </button>

) : (

  <span className="text-green-600 font-bold">
    Released
  </span>

)}

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}