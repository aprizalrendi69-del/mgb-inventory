"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { exportReportPDF } from "@/lib/exportReportPdf";
import { exportReportExcel } from "@/lib/exportReportExcel";
import { printTable } from "@/lib/print";

export default function DetailCustomer() {
  const params = useParams();

  const id = String(params.id);

  const [data, setData] = useState<any>(null);

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      setLoading(true);

      let url = `/api/laporan/customer/${id}`;

      if (start && end) {
        url += `?start=${start}&end=${end}`;
      }

      console.log("CALL API =", url);

      const res = await fetch(url, {
        cache: "no-store",
      });

      const json = await res.json();

      console.log("DETAIL CUSTOMER RESPONSE =", json);

      if (json.success) {
        setData(json.data);
      } else {
        console.error(
          "API CUSTOMER ERROR:",
          json.message
        );
      }
    } catch (error) {
      console.error(
        "LOAD DETAIL CUSTOMER ERROR:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="p-6">
        Loading...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        Data customer tidak ditemukan.
      </div>
    );
  }

  const rows: any[][] = [];

  data.deliveries?.forEach((doItem: any) => {
    doItem.items?.forEach((item: any) => {
      rows.push([
        doItem.id,

        doItem.number,

        new Date(
          doItem.deliveryDate
        ).toLocaleDateString("id-ID"),

        item.barang?.name ?? "-",

        item.qty ?? 0,

        "Rp " +
          Number(
            item.price ?? 0
          ).toLocaleString("id-ID"),

        "Rp " +
          Number(
            item.subtotal ?? 0
          ).toLocaleString("id-ID"),
      ]);
    });
  });

  const columns = [
    "ID DO",
    "No DO",
    "Tanggal",
    "Barang",
    "Qty",
    "Harga",
    "Total",
  ];

  return (
    <div className="p-6 space-y-6">

      {/* HEADER */}

      <div className="bg-white rounded-xl shadow p-6">

        <h1 className="text-2xl font-bold">
          Detail Customer
        </h1>

        <div className="mt-2 text-xl font-semibold">
          {data.customer?.name ?? "-"}
        </div>

      </div>


      {/* FILTER */}

      <div className="bg-white rounded-xl shadow p-5">

        <div className="flex flex-wrap gap-3 items-end">

          <div>
            <label className="block text-sm font-medium mb-1">
              Dari
            </label>

            <input
              type="date"
              className="border p-2 rounded"
              value={start}
              onChange={(e) =>
                setStart(e.target.value)
              }
            />
          </div>


          <div>
            <label className="block text-sm font-medium mb-1">
              Sampai
            </label>

            <input
              type="date"
              className="border p-2 rounded"
              value={end}
              onChange={(e) =>
                setEnd(e.target.value)
              }
            />
          </div>


          <button
            onClick={loadData}
            className="
              bg-blue-600
              hover:bg-blue-700
              text-white
              px-4
              py-2
              rounded
            "
          >
            Filter
          </button>

        </div>

      </div>


      {/* SUMMARY */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-sm text-gray-500">
            Total Transaksi
          </div>

          <div className="text-2xl font-bold mt-1">
            {data.summary?.transaksi ?? 0}
          </div>
        </div>


        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-sm text-gray-500">
            Total Qty
          </div>

          <div className="text-2xl font-bold mt-1">
            {data.summary?.qty ?? 0}
          </div>
        </div>


        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-sm text-gray-500">
            Total Nominal
          </div>

          <div className="text-2xl font-bold mt-1">
            Rp{" "}
            {Number(
              data.summary?.nominal ?? 0
            ).toLocaleString("id-ID")}
          </div>
        </div>

      </div>


      {/* EXPORT */}

      <div className="bg-white rounded-xl shadow p-5">

        <div className="flex flex-wrap gap-2">

          <button
            onClick={() =>
              exportReportPDF(
                "Detail Customer",
                columns,
                rows
              )
            }
            className="
              bg-red-600
              hover:bg-red-700
              text-white
              px-4
              py-2
              rounded
            "
          >
            Export PDF
          </button>


          <button
            onClick={() =>
              exportReportExcel(
                "Detail Customer",
                columns,
                rows
              )
            }
            className="
              bg-green-600
              hover:bg-green-700
              text-white
              px-4
              py-2
              rounded
            "
          >
            Export Excel
          </button>


          <button
            onClick={() =>
              printTable(
                columns,
                rows
              )
            }
            className="
              bg-gray-700
              hover:bg-gray-800
              text-white
              px-4
              py-2
              rounded
            "
          >
            Print
          </button>

        </div>

      </div>


      {/* TABLE */}

      <div className="bg-white rounded-xl shadow overflow-hidden">

        <div className="overflow-x-auto">

          <table className="w-full border-collapse">

            <thead>

              <tr className="bg-gray-100">

                {columns.map(
                  (
                    column,
                    index
                  ) => (

                    <th
                      key={`header-${index}`}
                      className="
                        border
                        p-3
                        text-left
                        font-bold
                      "
                    >
                      {column}
                    </th>

                  )
                )}

              </tr>

            </thead>


            <tbody>

              {rows.length === 0 ? (

                <tr>

                  <td
                    colSpan={columns.length}
                    className="
                      border
                      p-6
                      text-center
                      text-gray-500
                    "
                  >
                    Tidak ada transaksi.
                  </td>

                </tr>

              ) : (

                rows.map(
                  (
                    row,
                    rowIndex
                  ) => (

                    <tr
                      key={`row-${rowIndex}`}
                      className="hover:bg-gray-50"
                    >

                      {row.map(
                        (
                          value,
                          columnIndex
                        ) => (

                          <td
                            key={`cell-${rowIndex}-${columnIndex}`}
                            className="border p-3"
                          >
                            {value}
                          </td>

                        )
                      )}

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}