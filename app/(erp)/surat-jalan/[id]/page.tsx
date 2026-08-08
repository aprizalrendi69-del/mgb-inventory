"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { exportSuratJalanPDF } from "@/lib/exportSuratJalanPdf";
import { exportSuratJalanExcel } from "@/lib/exportSuratJalanExcel";

export default function SuratJalanDetailPage() {
  const params = useParams();

  const id = String(params.id);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);

      const res = await fetch(`/api/delivery-order/${id}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setData(json.data);
      } else {
        alert(json.message || "Data Surat Jalan tidak ditemukan");
      }
    } catch (error) {
      console.error(error);
      alert("Gagal mengambil data Surat Jalan");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) {
      load();
    }
  }, [id]);

  async function processDelivery() {
    if (!confirm("Release Delivery Order?")) {
      return;
    }

    try {
      const res = await fetch(
        `/api/delivery-order/${id}/approve`,
        {
          method: "PUT",
        }
      );

      const json = await res.json();

      alert(json.message);

      if (json.success) {
        load();
      }
    } catch (error) {
      console.error(error);
      alert("Gagal memproses pengiriman");
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-2xl shadow-sm border p-8">
          Loading...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-red-600">
          Data Surat Jalan tidak ditemukan.
        </div>
      </div>
    );
  }

  const items = data.items ?? [];

  const total = items.reduce(
    (sum: number, item: any) => {
      const qty = Number(item.qty ?? 0);
      const price = Number(item.price ?? 0);

      const subtotal =
        item.subtotal != null && Number(item.subtotal) > 0
          ? Number(item.subtotal)
          : qty * price;

      return sum + subtotal;
    },
    0
  );

  return (
    <div className="p-6 md:p-8">
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">

        {/* HEADER */}
        <div className="px-6 md:px-8 py-6 border-b bg-gray-50">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                SURAT JALAN
              </h1>

              <p className="text-gray-500 mt-1">
                PT. Mitra Garam Bogatama
              </p>

              <p className="text-sm text-gray-400 mt-1">
                Detail pengiriman barang
              </p>
            </div>

            <div className="flex flex-wrap gap-2">

              {data.status === "DRAFT" && (
                <button
                  onClick={processDelivery}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-lg font-medium transition"
                >
                  Proses Pengiriman
                </button>
              )}

              <button
                onClick={() => exportSuratJalanPDF(data)}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-medium transition"
              >
                Export PDF
              </button>

              <button
                onClick={() => exportSuratJalanExcel(data)}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-medium transition"
              >
                Export Excel
              </button>

              <a
                href={`/surat-jalan/print?id=${data.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition"
              >
                Print
              </a>

            </div>
          </div>
        </div>

        {/* INFORMASI SURAT JALAN */}
        <div className="p-6 md:p-8">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5 mb-8">

            <div>
              <p className="text-sm text-gray-500">
                No Surat Jalan
              </p>

              <p className="font-semibold text-gray-900 mt-1">
                {data.suratJalan?.number ?? "-"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                No Delivery
              </p>

              <p className="font-semibold text-gray-900 mt-1">
                {data.number ?? "-"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Customer
              </p>

              <p className="font-semibold text-gray-900 mt-1">
                {data.customer?.name ?? "-"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Tanggal
              </p>

              <p className="font-semibold text-gray-900 mt-1">
                {data.deliveryDate
                  ? new Date(data.deliveryDate).toLocaleDateString(
                      "id-ID"
                    )
                  : "-"}
              </p>
            </div>

            <div className="md:col-span-2">
              <p className="text-sm text-gray-500">
                Alamat Customer
              </p>

              <p className="font-semibold text-gray-900 mt-1">
                {data.customer?.address ?? "-"}
              </p>
            </div>

          </div>

          {/* STATUS */}
          <div className="mb-6">
            <span className="text-sm text-gray-500 mr-2">
              Status:
            </span>

            <span
              className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                data.status === "DRAFT"
                  ? "bg-yellow-100 text-yellow-700"
                  : data.status === "APPROVED"
                  ? "bg-blue-100 text-blue-700"
                  : data.status === "DELIVERED"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {data.status}
            </span>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">

            <table className="w-full border-collapse border border-gray-200">

              <thead>
                <tr className="bg-gray-100">

                  <th className="border border-gray-200 px-4 py-3 text-center text-sm font-semibold">
                    No
                  </th>

                  <th className="border border-gray-200 px-4 py-3 text-left text-sm font-semibold">
                    Kode
                  </th>

                  <th className="border border-gray-200 px-4 py-3 text-left text-sm font-semibold">
                    Nama Barang
                  </th>

                  <th className="border border-gray-200 px-4 py-3 text-center text-sm font-semibold">
                    Satuan
                  </th>

                  <th className="border border-gray-200 px-4 py-3 text-right text-sm font-semibold">
                    Qty
                  </th>

                  <th className="border border-gray-200 px-4 py-3 text-right text-sm font-semibold">
                    Harga
                  </th>

                  <th className="border border-gray-200 px-4 py-3 text-right text-sm font-semibold">
                    Subtotal
                  </th>

                </tr>
              </thead>

              <tbody>

                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="border border-gray-200 px-4 py-8 text-center text-gray-500"
                    >
                      Tidak ada barang.
                    </td>
                  </tr>
                ) : (
                  items.map((item: any, index: number) => {

                    const qty = Number(item.qty ?? 0);

                    const price = Number(item.price ?? 0);

                    const subtotal =
                      item.subtotal != null &&
                      Number(item.subtotal) > 0
                        ? Number(item.subtotal)
                        : qty * price;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50"
                      >

                        <td className="border border-gray-200 px-4 py-3 text-center">
                          {index + 1}
                        </td>

                        <td className="border border-gray-200 px-4 py-3">
                          {item.barang?.code ?? "-"}
                        </td>

                        <td className="border border-gray-200 px-4 py-3 font-medium">
                          {item.barang?.name ?? "-"}
                        </td>

                        <td className="border border-gray-200 px-4 py-3 text-center">
                          {item.barang?.unit ?? "-"}
                        </td>

                        <td className="border border-gray-200 px-4 py-3 text-right">
                          {qty.toLocaleString("id-ID")}
                        </td>

                        <td className="border border-gray-200 px-4 py-3 text-right whitespace-nowrap">
                          Rp{" "}
                          {price.toLocaleString("id-ID")}
                        </td>

                        <td className="border border-gray-200 px-4 py-3 text-right font-medium whitespace-nowrap">
                          Rp{" "}
                          {subtotal.toLocaleString("id-ID")}
                        </td>

                      </tr>
                    );
                  })
                )}

              </tbody>

            </table>
          </div>

          {/* TOTAL */}
          <div className="flex justify-end mt-6">

            <div className="w-full md:w-auto min-w-[280px]">

              <div className="flex justify-between items-center bg-gray-50 border rounded-xl px-5 py-4">

                <span className="text-lg font-semibold text-gray-700">
                  TOTAL
                </span>

                <span className="text-xl font-bold text-gray-900">
                  Rp {total.toLocaleString("id-ID")}
                </span>

              </div>

            </div>

          </div>

          {/* REMARKS */}
          {data.remarks && (
            <div className="mt-6">

              <p className="text-sm text-gray-500">
                Catatan
              </p>

              <div className="mt-2 bg-gray-50 border rounded-lg px-4 py-3">
                {data.remarks}
              </div>

            </div>
          )}

          {/* SIGNATURE */}
          <div className="grid grid-cols-3 text-center mt-24 gap-10">

            <div>
              <p className="font-medium">
                Dibuat
              </p>

              <div className="h-24"></div>

              <div className="border-b border-gray-400 max-w-[160px] mx-auto"></div>
            </div>

            <div>
              <p className="font-medium">
                Gudang
              </p>

              <div className="h-24"></div>

              <div className="border-b border-gray-400 max-w-[160px] mx-auto"></div>
            </div>

            <div>
              <p className="font-medium">
                Penerima
              </p>

              <div className="h-24"></div>

              <div className="border-b border-gray-400 max-w-[160px] mx-auto"></div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}