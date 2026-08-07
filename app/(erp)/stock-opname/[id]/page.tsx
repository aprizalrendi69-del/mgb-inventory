"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import CameraBarcodeScanner from "@/components/CameraBarcodeScanner";

export default function StockOpnameDetailPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [scanResult, setScanResult] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  async function loadData() {
    try {
      const res = await fetch(`/api/stock-opname/${id}`, {
        cache: "no-store",
      });

      const json = await res.json();

      console.log("DETAIL:", json);

      if (json.success) {
        setData(json.data);
      }
    } catch (error) {
      console.error("LOAD STOCK OPNAME ERROR:", error);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  async function updateQty(
    itemId: number,
    qty: number
  ) {
    try {
      await fetch(`/api/stock-opname/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemId,
          physicalQty: qty,
        }),
      });

      loadData();
    } catch (error) {
      console.error("UPDATE QTY ERROR:", error);
    }
  }

  const findBarangByBarcode = useCallback(
  (barcode: string) => {
    if (!data?.items) return;

    const cleanBarcode = barcode.trim();

    console.log(
      "BARCODE YANG DICARI:",
      cleanBarcode
    );

    const found = data.items.find(
      (item: any) =>
        String(item.barang?.barcode || "").trim() ===
        cleanBarcode
    );

    if (found) {
      alert(
        `Barang ditemukan: ${found.barang.name}`
      );

      setShowScanner(false);
      setScanResult("");

      const el = document.getElementById(
        `item-${found.id}`
      );

      if (el) {
        el.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    } else {
      alert(
        "Barcode tidak ditemukan dalam Stock Opname"
      );

      setScanResult("");
    }
    },
  [data]
);

  async function approve() {
    const ok = confirm(
      "Approve Stock Opname?"
    );

    if (!ok) return;

    try {
      const res = await fetch(
        `/api/stock-opname/${id}`,
        {
          method: "POST",
        }
      );

      const json = await res.json();

      alert(json.message);

      if (json.success) {
        router.push("/stock-opname");
      }
    } catch (error) {
      console.error(
        "APPROVE ERROR:",
        error
      );

      alert(
        "Gagal approve Stock Opname"
      );
    }
  }

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
        Data tidak ditemukan
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* HEADER */}

      <div className="bg-white rounded-xl shadow p-5">

        <div className="flex flex-wrap items-center justify-between gap-4">

          <div>

            <h1 className="text-2xl font-bold">
              Stock Opname {data.code}
            </h1>

            <div className="mt-2 text-sm">
              Status :{" "}
              <span className="font-bold">
                {data.status}
              </span>
            </div>

            <div className="text-sm text-gray-600">
              Tanggal :{" "}
              {new Date(
                data.date
              ).toLocaleDateString(
                "id-ID"
              )}
            </div>

          </div>


          {/* BUTTON */}

          <div className="flex flex-wrap gap-2">

            <button
              onClick={() =>
                setShowScanner(true)
              }
              className="
                bg-purple-600
                hover:bg-purple-700
                text-white
                px-4
                py-2
                rounded
              "
            >
              📷 SCAN BARCODE
            </button>


            <button
              onClick={() =>
                window.print()
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
              PRINT
            </button>


            <a
              href={`/api/laporan/stock-opname/${id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="
                bg-red-600
                hover:bg-red-700
                text-white
                px-4
                py-2
                rounded
              "
            >
              PDF
            </a>


            <a
              href={`/api/laporan/stock-opname/${id}/excel`}
              className="
                bg-green-600
                hover:bg-green-700
                text-white
                px-4
                py-2
                rounded
              "
            >
              EXCEL
            </a>


            {data.status !== "APPROVED" && (
              <button
                onClick={approve}
                className="
                  bg-blue-600
                  hover:bg-blue-700
                  text-white
                  px-4
                  py-2
                  rounded
                "
              >
                APPROVE
              </button>
            )}

          </div>

        </div>

      </div>


      {/* CAMERA MODAL */}

      {showScanner && (

        <div
          className="
            fixed
            inset-0
            z-50
            bg-black/80
            flex
            items-center
            justify-center
            p-4
          "
        >

          <div
            className="
              bg-white
              rounded-2xl
              w-full
              max-w-md
              overflow-hidden
              shadow-2xl
            "
          >

            {/* CAMERA HEADER */}

            <div
              className="
                flex
                items-center
                justify-between
                p-4
                border-b
              "
            >

              <h2 className="font-bold text-lg">
                Scan Barcode Barang
              </h2>


              <button
                onClick={() => {
                  setShowScanner(false);
                  setScanResult("");
                }}
                className="
                  text-red-600
                  font-bold
                  text-xl
                "
              >
                ✕
              </button>

            </div>


            {/* CAMERA */}

            <div className="p-4">

              <div
                className="
                  bg-black
                  rounded-xl
                  overflow-hidden
                "
              >

                <CameraBarcodeScanner
  onScan={(barcode) => {
    console.log(
      "BARCODE TERBACA:",
      barcode
    );

    setScanResult(barcode);

    findBarangByBarcode(barcode);
  }}
  onClose={() => {
    setShowScanner(false);
    setScanResult("");
  }}
/>

              </div>


              {/* HASIL SCAN */}

              <div className="mt-4">

                <label
                  className="
                    block
                    text-sm
                    font-medium
                    mb-1
                  "
                >
                  Hasil Scan
                </label>


                <input
                  className="
                    border
                    rounded-lg
                    p-2
                    w-full
                  "
                  placeholder="Barcode..."
                  value={scanResult}
                  onChange={(e) =>
                    setScanResult(
                      e.target.value
                    )
                  }
                />

              </div>


              {/* CARI MANUAL */}

              <button
                onClick={() => {

                  if (
                    scanResult.trim()
                  ) {
                    findBarangByBarcode(
                      scanResult
                    );
                  }

                }}
                className="
                  mt-3
                  w-full
                  bg-blue-600
                  hover:bg-blue-700
                  text-white
                  py-2
                  rounded-lg
                "
              >
                Cari Barcode
              </button>


              {/* TUTUP */}

              <button
                onClick={() => {

                  setShowScanner(false);
                  setScanResult("");

                }}
                className="
                  mt-2
                  w-full
                  bg-red-600
                  hover:bg-red-700
                  text-white
                  py-2
                  rounded-lg
                "
              >
                Tutup Kamera
              </button>

            </div>

          </div>

        </div>

      )}


      {/* TABLE */}

      <div
        className="
          bg-white
          rounded-xl
          shadow
          overflow-hidden
        "
      >

        <div className="overflow-x-auto">

          <table
            className="
              w-full
              border-collapse
            "
          >

            <thead>

              <tr className="bg-gray-100">

                <th className="border p-3 text-center">
                  No
                </th>

                <th className="border p-3 text-left">
                  Barang
                </th>

                <th className="border p-3 text-center">
                  System Qty
                </th>

                <th className="border p-3 text-center">
                  Physical Qty
                </th>

                <th className="border p-3 text-center">
                  Selisih
                </th>

              </tr>

            </thead>


            <tbody>

              {data.items.map(
                (
                  item: any,
                  index: number
                ) => (

                  <tr
                    key={item.id}
                    id={`item-${item.id}`}
                  >

                    <td
                      className="
                        border
                        p-3
                        text-center
                      "
                    >
                      {index + 1}
                    </td>


                    <td className="border p-3">

                      <div className="font-medium">
                        {item.barang?.name}
                      </div>

                      <div
                        className="
                          text-xs
                          text-gray-500
                        "
                      >
                        Barcode:{" "}
                        {item.barang?.barcode ||
                          "-"}
                      </div>

                    </td>


                    <td
                      className="
                        border
                        p-3
                        text-center
                      "
                    >
                      {item.systemQty}
                    </td>


                    <td
                      className="
                        border
                        p-3
                        text-center
                      "
                    >

                      <input
                        type="number"
                        value={
                          item.physicalQty
                        }
                        disabled={
                          data.status ===
                          "APPROVED"
                        }
                        onChange={(e) => {

                          updateQty(
                            item.id,
                            Number(
                              e.target.value
                            )
                          );

                        }}
                        className="
                          border
                          rounded
                          px-2
                          py-1
                          w-24
                          text-center
                        "
                      />

                    </td>


                    <td
                      className={`
                        border
                        p-3
                        text-center
                        font-bold
                        ${
                          item.difference !== 0
                            ? "text-red-600"
                            : "text-green-600"
                        }
                      `}
                    >
                      {item.difference}
                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}