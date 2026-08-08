"use client";

import { useEffect, useState } from "react";

export default function PurchasePage() {
  const [purchase, setPurchase] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadPurchase() {
    try {
      setLoading(true);

      const res = await fetch("/api/purchase", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setPurchase(json.data || []);
      } else {
        alert(json.message || "Gagal mengambil data Purchase");
      }
    } catch (err) {
      console.error("PURCHASE ERROR:", err);
    } finally {
      setLoading(false);
    }
  }

  async function approvePurchase(id: number) {
    const ok = confirm("Approve Purchase Order?");
    if (!ok) return;

    try {
      const res = await fetch(`/api/purchase/${id}/approve`, {
        method: "POST",
      });

      const json = await res.json();

      if (json.success) {
        alert("Purchase berhasil di-Approve");
        loadPurchase();
      } else {
        alert(json.message || "Gagal approve purchase");
      }
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat approve purchase");
    }
  }

  async function receivePurchase(id: number) {
    const ok = confirm("Terima Barang?");
    if (!ok) return;

    try {
      const res = await fetch(`/api/purchase/${id}/receive`, {
        method: "PUT",
      });

      const json = await res.json();

      if (json.success) {
        alert("Barang berhasil diterima");
        loadPurchase();
      } else {
        alert(json.message || "Gagal menerima barang");
      }
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat menerima barang");
    }
  }

  useEffect(() => {
    loadPurchase();
  }, []);

  function Badge({ status }: { status: string }) {
    switch (status) {
      case "DRAFT":
        return (
          <span className="inline-block rounded bg-yellow-200 px-3 py-1 text-xs font-semibold text-yellow-800">
            DRAFT
          </span>
        );

      case "APPROVED":
        return (
          <span className="inline-block rounded bg-blue-200 px-3 py-1 text-xs font-semibold text-blue-800">
            APPROVED
          </span>
        );

      case "RECEIVED":
        return (
          <span className="inline-block rounded bg-green-200 px-3 py-1 text-xs font-semibold text-green-800">
            RECEIVED
          </span>
        );

      default:
        return (
          <span className="inline-block rounded bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700">
            {status || "UNKNOWN"}
          </span>
        );
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-xl bg-white p-8 text-center shadow">
          Loading Purchase...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Purchase Order
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Kelola Purchase Order dan penerimaan barang
            </p>
          </div>

          <a
            href="/purchase/new"
            className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            + Purchase Baru
          </a>
        </div>

        {/* TABLE */}

        <div className="overflow-hidden rounded-xl bg-white shadow">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border p-3 text-left">
                    No PO
                  </th>

                  <th className="border p-3 text-left">
                    Tanggal
                  </th>

                  <th className="border p-3 text-left">
                    Supplier
                  </th>

                  <th className="border p-3 text-right">
                    Total
                  </th>

                  <th className="border p-3 text-left">
                    Status
                  </th>

                  <th className="border p-3 text-left">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>
                {purchase.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-10 text-center text-slate-500"
                    >
                      Belum ada Purchase Order
                    </td>
                  </tr>
                )}

                {purchase.map((item: any) => (
                  <tr
                    key={item.id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="border p-3 font-semibold text-slate-700">
                      {item.number}
                    </td>

                    <td className="border p-3">
                      {item.purchaseDate
                        ? new Date(
                            item.purchaseDate
                          ).toLocaleDateString("id-ID")
                        : "-"}
                    </td>

                    <td className="border p-3">
                      {item.supplier?.name || "-"}
                    </td>

                    <td className="border p-3 text-right font-semibold">
                      Rp{" "}
                      {Number(item.total || 0).toLocaleString(
                        "id-ID"
                      )}
                    </td>

                    <td className="border p-3">
                      <Badge status={item.status} />
                    </td>

                    <td className="border p-3">
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`/purchase/${item.id}`}
                          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          Detail
                        </a>

                        {item.status === "DRAFT" && (
                          <button
                            onClick={() =>
                              approvePurchase(item.id)
                            }
                            className="rounded bg-orange-600 px-3 py-1 text-sm font-medium text-white hover:bg-orange-700"
                          >
                            Approve
                          </button>
                        )}

                        {item.status === "APPROVED" && (
                          <button
                            onClick={() =>
                              receivePurchase(item.id)
                            }
                            className="rounded bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700"
                          >
                            Receive
                          </button>
                        )}

                        <a
                          href={`/purchase/print?id=${item.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded bg-gray-800 px-3 py-1 text-sm font-medium text-white hover:bg-gray-900"
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
        </div>
      </div>
    </div>
  );
}