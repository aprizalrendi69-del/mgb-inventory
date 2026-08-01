"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { exportPurchasePDF } from "@/lib/exportPurchasePdf";
import { exportPurchaseExcel } from "@/lib/exportPurchaseExcel";

export default function DetailPurchase() {
  const params = useParams();

  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadPurchase() {
    try {
      const res = await fetch(`/api/purchase/${params.id}`);
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

  useEffect(() => {
    loadPurchase();
  }, []);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!purchase) {
    return <div className="p-8">Purchase tidak ditemukan.</div>;
  }

   const totalItem = purchase.items?.length ?? 0;

const totalQty =
  purchase.items?.reduce(
    (sum: number, item: any) => sum + Number(item.qty),
    0
  ) ?? 0;

const totalNilai = Number(purchase.total ?? 0);

const supplier = purchase.supplier?.name ?? "-";

  return (
    <div className="p-8">

      {/* Header */}

      <div className="flex justify-between items-center mb-6">

        <div>
          <h1 className="text-3xl font-bold">
            Detail Purchase Order
          </h1>

          <p className="text-gray-500">
            {purchase.number}
          </p>
        </div>

<div className="flex gap-2">


<button
  onClick={() => exportPurchasePDF(purchase)}
  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
>
  Export PDF
</button>


<button
  onClick={() => exportPurchaseExcel(purchase)}
  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
>
  Export Excel
</button>


<a
  href={`/purchase/print?id=${purchase.id}`}
  target="_blank"
  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
>
  Print PO
</a>


{
purchase.status === "APPROVED" && (

<a
  href={`/barang-masuk/create?purchaseId=${purchase.id}`}
  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
>
  Receive Barang
</a>

)
}


{
purchase.status === "RECEIVED" && (

<a
  href="/barang-masuk"
  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
>
  Lihat Barang Masuk
</a>

)
}


{
purchase.status === "COMPLETED" && (

<span
className="bg-gray-700 text-white px-4 py-2 rounded"
>
Selesai
</span>

)
}

<a
href="/purchase"
className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
>
Kembali
</a>


</div>  {/* tutup flex gap-2 */}

</div>  {/* TAMBAHAN: tutup header justify-between */}


<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">

  <div className="bg-blue-600 text-white rounded-xl p-5 shadow">
    <div className="text-sm opacity-80">
      Supplier
    </div>

    <div className="text-xl font-bold mt-2">
      {supplier}
    </div>
  </div>

  <div className="bg-green-600 text-white rounded-xl p-5 shadow">
    <div className="text-sm opacity-80">
      Jumlah Item
    </div>

    <div className="text-3xl font-bold mt-2">
      {totalItem}
    </div>
  </div>

  <div className="bg-orange-500 text-white rounded-xl p-5 shadow">
    <div className="text-sm opacity-80">
      Total Qty
    </div>

    <div className="text-3xl font-bold mt-2">
      {totalQty}
    </div>
  </div>

  <div className="bg-purple-700 text-white rounded-xl p-5 shadow">
    <div className="text-sm opacity-80">
      Nilai Purchase
    </div>

    <div className="text-lg font-bold mt-2">
      Rp {totalNilai.toLocaleString("id-ID")}
    </div>
  </div>

</div>

{/* Timeline Status */}

<div className="bg-white border rounded-xl p-6 mb-6">

<h2 className="font-bold text-lg mb-5">
  Status Purchase Order
</h2>


<div className="flex items-center justify-between">


{[
  {
    name:"DRAFT",
    label:"Draft"
  },
  {
    name:"APPROVED",
    label:"Approved"
  },
  {
    name:"RECEIVED",
    label:"Received"
  },
  {
    name:"COMPLETED",
    label:"Completed"
  }
].map((step,index)=>{


const statusOrder=[
  "DRAFT",
  "APPROVED",
  "RECEIVED",
  "COMPLETED"
];


const current =
statusOrder.indexOf(purchase.status);


const active =
index <= current;


return (

<div
key={step.name}
className="flex-1 text-center"
>

<div
className={`
mx-auto w-10 h-10 rounded-full flex items-center justify-center text-white font-bold
${
active
?"bg-green-600"
:"bg-gray-300"
}
`}
>
{index+1}
</div>


<div className="mt-2 text-sm font-semibold">
{step.label}
</div>


</div>

)

})}


</div>

</div>

      {/* Informasi PO */}

      <div className="grid md:grid-cols-2 gap-5">

  <div>

    <h2 className="font-bold text-lg mb-3">
      Informasi Purchase
    </h2>

    <table className="w-full">

      <tbody>

        <tr>
  <td className="py-1 font-semibold">
    No PO
  </td>

  <td>
    : {purchase.number}
  </td>
</tr>

        <tr>
          <td className="py-1 font-semibold">
            Tanggal
          </td>
          <td>
            : {new Date(
                purchase.purchaseDate
              ).toLocaleDateString("id-ID")}
          </td>
        </tr>

        <tr>
  <td className="py-1 font-semibold">
    Status
  </td>

  <td>
    :
    <span
      className={`ml-2 px-3 py-1 rounded-full text-xs font-bold text-white ${
        purchase.status === "APPROVED"
          ? "bg-green-600"
          : purchase.status === "RECEIVED"
          ? "bg-blue-600"
          : purchase.status === "CANCELLED"
          ? "bg-red-600"
          : "bg-yellow-500"
      }`}
    >
      {purchase.status}
    </span>
  </td>
</tr>

        <tr>
          <td className="py-1 font-semibold">
            Total
          </td>
          <td>
            : Rp {Number(
                purchase.total
              ).toLocaleString("id-ID")}
          </td>
        </tr>

      </tbody>

    </table>

  </div>

  <div>

    <h2 className="font-bold text-lg mb-3">
      Informasi Supplier
    </h2>

    <table className="w-full">

      <tbody>

        <tr>
          <td className="py-1 font-semibold w-32">
            Nama
          </td>
          <td>
            : {purchase.supplier?.name}
          </td>
        </tr>

        <tr>
          <td className="py-1 font-semibold">
            PIC
          </td>
          <td>
            : {purchase.supplier?.contactPerson ?? "-"}
          </td>
        </tr>

        <tr>
          <td className="py-1 font-semibold">
            Telepon
          </td>
          <td>
            : {purchase.supplier?.phone ?? "-"}
          </td>
        </tr>

        <tr>
          <td className="py-1 font-semibold">
            Email
          </td>
          <td>
            : {purchase.supplier?.email ?? "-"}
          </td>
        </tr>

        <tr>
          <td className="py-1 font-semibold">
            Alamat
          </td>
          <td>
            : {purchase.supplier?.address ?? "-"}
          </td>
        </tr>

      </tbody>

    </table>

  </div>

</div>


      {/* Detail Barang */}
      
      <h2 className="text-xl font-bold mt-8 mb-3">
  Detail Barang Purchase
</h2>

      <table className="w-full border-collapse border bg-white">

        <thead>

<tr className="bg-blue-700 text-white">

  <th className="border p-2 w-14">
    No
  </th>

  <th className="border p-2">
    Kode
  </th>

            <th className="border p-2">
              Nama Barang
            </th>

            <th className="border p-2">
              Satuan
            </th>

            <th className="border p-2">
              Qty
            </th>

            <th className="border p-2">
              Harga
            </th>

            <th className="border p-2">
              Subtotal
            </th>

          </tr>

        </thead>

        <tbody>

          {purchase.items?.map((item:any,index:number)=>(

<tr
  key={item.id}
  className="hover:bg-blue-50 transition"
>

  <td className="border p-2 text-center">
    {index + 1}
  </td>

  <td className="border p-2">
    {item.barang?.code}
  </td>

  <td className="border p-2">
    {item.barang?.name}
  </td>

  <td className="border p-2 text-center">
    {item.barang?.unit}
  </td>

  <td className="border p-2 text-center">
    {item.qty}
  </td>

  <td className="border p-2 text-right">
    Rp {Number(item.price).toLocaleString("id-ID")}
  </td>

  <td className="border p-2 text-right">
    Rp {(Number(item.qty) * Number(item.price)).toLocaleString("id-ID")}
  </td>

</tr>

          ))}

        </tbody>

      </table>

      {/* Total */}

      <div className="flex justify-end mt-6">

        <div className="bg-blue-700 text-white rounded-xl shadow-lg p-6 w-80">

          <div className="flex justify-between">

            <span className="font-bold">
              TOTAL
            </span>

            <span className="font-extrabold text-3xl">
              Rp{" "}

              {Number(
                purchase.total
              ).toLocaleString("id-ID")}

            </span>

          </div>

        </div>

      </div>

    </div>
  );
}