"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function PrintSuratJalan() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/delivery-order/${id}`);
      const json = await res.json();

      if (json.success) {
        setData(json.data);

        setTimeout(() => {
          window.print();
        }, 500);
      }
    }

    if (id) {
      load();
    }
  }, [id]);

  if (!data) {
    return <div className="p-10">Loading...</div>;
  }

  const total = data.items.reduce(
    (sum: number, item: any) => sum + Number(item.subtotal || 0),
    0
  );

  return (
    <div className="max-w-5xl mx-auto bg-white p-10">

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">
          PT. MITRA GARAM BOGATAMA
        </h1>

        <h2 className="text-xl mt-2 font-semibold">
          SURAT JALAN
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-8">

        <div>
          <b>No Surat Jalan</b><br />
          {data.suratJalan?.number}
        </div>

        <div>
          <b>No Delivery</b><br />
          {data.number}
        </div>

        <div>
          <b>Customer</b><br />
          {data.customer?.name}
        </div>

        <div>
          <b>Tanggal</b><br />
          {new Date(data.deliveryDate).toLocaleDateString("id-ID")}
        </div>

      </div>

      <table className="w-full border border-collapse">

        <thead>

          <tr className="bg-gray-100">

            <th className="border p-2">No</th>
            <th className="border p-2">Kode</th>
            <th className="border p-2">Barang</th>
            <th className="border p-2">Satuan</th>
            <th className="border p-2">Qty</th>
            <th className="border p-2">Harga</th>
            <th className="border p-2">Subtotal</th>

          </tr>

        </thead>

        <tbody>

          {data.items.map((item: any, index: number) => (

            <tr key={item.id}>

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
                Rp {Number(item.subtotal).toLocaleString("id-ID")}
              </td>

            </tr>

          ))}

        </tbody>

      </table>

      <div className="flex justify-end mt-8">

        <div className="text-xl font-bold">
          Total : Rp {total.toLocaleString("id-ID")}
        </div>

      </div>

      <div className="grid grid-cols-3 text-center mt-24">

        <div>
          Dibuat
          <br /><br /><br /><br />
          __________________
        </div>

        <div>
          Gudang
          <br /><br /><br /><br />
          __________________
        </div>

        <div>
          Penerima
          <br /><br /><br /><br />
          __________________
        </div>

      </div>

    </div>
  );
}