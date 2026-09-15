"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { exportPurchasePDF } from "@/lib/exportPurchasePdf";
import { exportPurchaseExcel } from "@/lib/exportPurchaseExcel";
import { COMPANY } from "@/lib/company";

export default function PurchasePrintPage() {
  const params = useSearchParams();
  const id = params.get("id");

  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        if (!id) return;

        const res = await fetch(`/api/purchase/${id}`, {
          cache: "no-store",
        });

        const json = await res.json();

        if (json.success) {
          setPurchase(json.data);
        } else {
          alert(json.message);
        }
      } catch (err) {
        console.error(err);
        alert("Gagal mengambil data Purchase.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

useEffect(() => {
  // Auto print dimatikan
}, [purchase]);
  if (loading) {
    return <div className="p-10">Loading...</div>;
  }

  if (!purchase) {
    return <div className="p-10">Purchase tidak ditemukan.</div>;
  }

  const grandTotal = Number(purchase.total ?? 0);

  return (
    <>
      <style>{`
        @media print{
          .no-print{
            display:none;
          }

          body{
            margin:0;
            padding:0;
          }

          @page{
            size:A4;
            margin:15mm;
          }
        }
      `}</style>

      <div className="max-w-5xl mx-auto bg-white p-10">

        <div className="flex justify-between items-start mb-10">

          <div>

<div className="mb-6 border-b pb-4">

  <h1 className="text-3xl font-bold">
  PT MITRA GARAM BOGATAMA
</h1>

  <p>{COMPANY.address}</p>

  <p>Telp : {COMPANY.phone}</p>

  <p>Email : {COMPANY.email}</p>

  <p>Website : {COMPANY.website}</p>

  <p>Contact Person : {COMPANY.contactPerson}</p>

</div>

            <div className="mt-6 border rounded p-4">

  <h2 className="text-lg font-bold mb-3">
    Informasi Purchase Order
  </h2>

  <div className="grid grid-cols-2 gap-y-2">

    <div>
      <b>No Purchase</b>
    </div>

    <div>
      : {purchase.number}
    </div>

    <div>
      <b>Tanggal</b>
    </div>

    <div>
      : {new Date(
          purchase.purchaseDate
        ).toLocaleDateString("id-ID")}
    </div>

    <div>
      <b>Status</b>
    </div>

    <div>
      : {purchase.status}
    </div>

    <div>
      <b>Total Item</b>
    </div>

    <div>
      : {purchase.items?.length ?? 0}
    </div>

    <div>
      <b>Total Nilai</b>
    </div>

    <div>
      : Rp {Number(purchase.total).toLocaleString("id-ID")}
    </div>

  </div>

</div>

          </div>

          <div className="text-right">

            <h2 className="text-2xl font-bold">
              MGB INVENTORY
            </h2>

            <p>Purchasing Department</p>

          </div>

</div>

<div className="text-center mb-8">
  <h1 className="text-2xl font-bold">
    PURCHASE ORDER
  </h1>

  <p className="text-gray-500">
    Dokumen Pembelian Barang
  </p>
</div>

<div className="mb-8">

  <h3 className="font-bold mb-2">
    Supplier
  </h3>

  <p>
    <b>Nama :</b> {purchase.supplier?.name}
  </p>

  <p>
    <b>Alamat :</b> {purchase.supplier?.address ?? "-"}
  </p>

  <p>
    <b>Telepon :</b> {purchase.supplier?.phone ?? "-"}
  </p>

  <p>
    <b>PIC :</b> {purchase.supplier?.contactPerson ?? "-"}
  </p>

  <p>
    <b>Email :</b> {purchase.supplier?.email ?? "-"}
  </p>

</div>

        <table className="w-full border border-collapse">

          <thead>

            <tr className="bg-gray-200">

              <th className="border p-2 w-16">
                No
              </th>

              <th className="border p-2">
                Barang
              </th>

              <th className="border p-2 w-24">
                Qty
              </th>

              <th className="border p-2 w-40">
                Harga
              </th>

              <th className="border p-2 w-44">
                Subtotal
              </th>

            </tr>

          </thead>

          <tbody>

            {(purchase.items ?? []).map(
              (item: any, index: number) => {

                const subtotal =
                  Number(item.qty) *
                  Number(item.price);

                return (

                  <tr key={item.id}>

                    <td className="border p-2 text-center">
                      {index + 1}
                    </td>

                    <td className="border p-2">
                      {item.barang?.name}
                    </td>

                    <td className="border p-2 text-center">
                      {item.qty}
                    </td>

                    <td className="border p-2 text-right">
                      Rp{" "}
                      {Number(item.price).toLocaleString("id-ID")}
                    </td>

                    <td className="border p-2 text-right">
                      Rp{" "}
                      {subtotal.toLocaleString("id-ID")}
                    </td>

                  </tr>

                );
              }
            )}

          </tbody>

        </table>

        <div className="mt-8 text-right">

          <h2 className="text-2xl font-bold">

            TOTAL

          </h2>

          <div className="text-3xl font-bold">

            Rp {grandTotal.toLocaleString("id-ID")}

          </div>

        </div>

        <div className="grid grid-cols-3 gap-20 mt-24 text-center">

          <div>

             Purchasing

            <br /><br /><br /><br />

            (__________________)

          </div>

          <div>

            Manager

            <br /><br /><br /><br />

            (__________________)

          </div>

          <div>

            Penerima Barang

            <br /><br /><br /><br />

            (__________________)

          </div>

        </div>

<div className="no-print flex justify-center gap-3 mt-10">

  <button
    onClick={() => exportPurchasePDF(purchase)}
    className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded"
  >
    Export PDF
  </button>

  <button
    onClick={() => exportPurchaseExcel(purchase)}
    className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded"
  >
    Export Excel
  </button>

  <button
    onClick={() => window.print()}
    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded"
  >
    Print
  </button>

  <button
    onClick={() => window.close()}
    className="bg-gray-700 hover:bg-gray-800 text-white px-5 py-2 rounded"
  >
    Tutup
  </button>

</div>

      </div>
    </>
  );
}