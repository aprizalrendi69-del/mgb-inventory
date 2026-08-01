"use client";

import { useEffect, useState } from "react";

export default function PurchasePage() {

  const [purchase, setPurchase] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadPurchase() {
    try {
      const res = await fetch("/api/purchase");
      const json = await res.json();

      if (json.success) {
        setPurchase(json.data);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  async function approvePurchase(id: number) {

    const ok = confirm("Approve Purchase Order?");

    if (!ok) return;

    const res = await fetch(`/api/purchase/${id}/approve`, {
      method: "POST",
    });

    const json = await res.json();

    if (json.success) {
      alert("Purchase berhasil di-Approve");
      loadPurchase();
    } else {
      alert(json.message);
    }
  }

  async function receivePurchase(id: number) {

    const ok = confirm("Terima Barang?");

    if (!ok) return;

    const res = await fetch(`/api/purchase/${id}/receive`, {
      method: "PUT",
    });

    const json = await res.json();

    if (json.success) {
      alert("Barang berhasil diterima");
      loadPurchase();
    } else {
      alert(json.message);
    }
  }

  useEffect(() => {
    loadPurchase();
  }, []);

  function Badge(status: string) {

    switch (status) {

      case "DRAFT":
        return (
          <span className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded">
            DRAFT
          </span>
        );

      case "APPROVED":
        return (
          <span className="bg-blue-200 text-blue-800 px-3 py-1 rounded">
            APPROVED
          </span>
        );

      case "RECEIVED":
        return (
          <span className="bg-green-200 text-green-800 px-3 py-1 rounded">
            RECEIVED
          </span>
        );

      default:
        return (
          <span className="bg-gray-200 px-3 py-1 rounded">
            UNKNOWN
          </span>
        );
    }
  }

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">

      <div className="flex justify-between mb-6">

        <h1 className="text-3xl font-bold">
          Purchase Order
        </h1>

        <a
          href="/purchase/new"
          className="bg-blue-600 text-white px-5 py-2 rounded"
        >
          + Purchase Baru
        </a>

      </div>

      <table className="w-full border">

        <thead>

          <tr className="bg-slate-100">
            <th className="border p-2">No PO</th>
            <th className="border p-2">Tanggal</th>
            <th className="border p-2">Supplier</th>
            <th className="border p-2">Total</th>
            <th className="border p-2">Status</th>
            <th className="border p-2">Aksi</th>
          </tr>

        </thead>

        <tbody>

          {purchase.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center p-8">
                Belum ada Purchase Order
              </td>
            </tr>
          )}

          {purchase.map((item: any) => (

            <tr key={item.id}>

              <td className="border p-2">{item.number}</td>

              <td className="border p-2">
                {new Date(item.purchaseDate).toLocaleDateString("id-ID")}
              </td>

              <td className="border p-2">
                {item.supplier?.name}
              </td>

              <td className="border p-2 text-right">
                Rp {item.total.toLocaleString("id-ID")}
              </td>

              <td className="border p-2">
                {Badge(item.status)}
              </td>

              <td className="border p-2">

                <div className="flex gap-2 flex-wrap">

                  <a
                    href={`/purchase/${item.id}`}
                    className="bg-blue-600 text-white px-3 py-1 rounded"
                  >
                    Detail
                  </a>

                  {item.status === "DRAFT" && (
                    <button
                      onClick={() => approvePurchase(item.id)}
                      className="bg-orange-600 text-white px-3 py-1 rounded"
                    >
                      Approve
                    </button>
                  )}

                  {item.status === "APPROVED" && (
                    <button
                      onClick={() => receivePurchase(item.id)}
                      className="bg-green-600 text-white px-3 py-1 rounded"
                    >
                      Receive
                    </button>
                  )}

                  <a
                    href={`/purchase/print?id=${item.id}`}
                    target="_blank"
                    className="bg-gray-800 text-white px-3 py-1 rounded"
                  >
                    Print PO
                  </a>

                </div>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}