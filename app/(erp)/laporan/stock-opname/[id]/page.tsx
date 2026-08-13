"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  ArrowLeft,
  RefreshCw,
  ClipboardCheck,
  Package,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Clock3,
} from "lucide-react";

type StockOpnameItem = {
  id: number;
  systemQty: number;
  physicalQty: number;
  difference: number;
  barang?: {
    id: number;
    code?: string;
    name?: string;
  };
};

type StockOpname = {
  id: number;
  code: string;
  date: string;
  status: string;
  items: StockOpnameItem[];
};

export default function DetailLaporanStockOpname() {
  const params = useParams();
  const router = useRouter();

  const id = String(params.id);

  const [data, setData] = useState<StockOpname | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch(`/api/stock-opname/${id}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setData(json.data);
      } else {
        setData(null);
      }
    } catch (error) {
      console.error(
        "Gagal mengambil detail stock opname:",
        error
      );

      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  function formatNumber(value: number) {
    return Number(value || 0).toLocaleString("id-ID");
  }

  function formatDate(value: string) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }
    );
  }

  function getStatusLabel(status: string) {
    const value = String(status).toUpperCase();

    if (value === "APPROVED") {
      return "Approved";
    }

    if (value === "DRAFT") {
      return "Draft";
    }

    return status || "-";
  }

  function getStatusClass(status: string) {
    const value = String(status).toUpperCase();

    if (value === "APPROVED") {
      return "border-green-200 bg-green-50 text-green-700";
    }

    if (value === "DRAFT") {
      return "border-yellow-200 bg-yellow-50 text-yellow-700";
    }

    return "border-gray-200 bg-gray-50 text-gray-700";
  }

  function getStatusIcon(status: string) {
    const value = String(status).toUpperCase();

    if (value === "APPROVED") {
      return <CheckCircle2 size={14} />;
    }

    if (value === "DRAFT") {
      return <Clock3 size={14} />;
    }

    return <AlertTriangle size={14} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8F7] p-4 md:p-6 lg:p-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex flex-col items-center">

            <RefreshCw
              size={30}
              className="
                mb-3
                animate-spin
                text-[#497F70]
              "
            />

            <p className="text-sm text-gray-500">
              Memuat detail stock opname...
            </p>

          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F6F8F7] p-4 md:p-6 lg:p-8">

        <div className="
          rounded-2xl
          border
          border-gray-100
          bg-white
          p-8
          text-center
          shadow-sm
        ">

          <div className="
            mx-auto
            mb-4
            flex
            h-14
            w-14
            items-center
            justify-center
            rounded-full
            bg-gray-100
            text-gray-400
          ">
            <ClipboardCheck size={25} />
          </div>

          <h2 className="font-semibold text-gray-800">
            Data Stock Opname Tidak Ditemukan
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Data yang ingin ditampilkan tidak tersedia.
          </p>

          <button
            onClick={() =>
              router.push(
                "/laporan/stock-opname"
              )
            }
            className="
              mt-5
              inline-flex
              items-center
              gap-2
              rounded-xl
              bg-[#497F70]
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              transition
              hover:bg-[#3d6c5f]
            "
          >
            <ArrowLeft size={16} />
            Kembali
          </button>

        </div>

      </div>
    );
  }

  const items = data.items ?? [];

  const totalItem = items.length;

  const totalSystemQty = items.reduce(
    (sum, item) =>
      sum + Number(item.systemQty || 0),
    0
  );

  const totalPhysicalQty = items.reduce(
    (sum, item) =>
      sum + Number(item.physicalQty || 0),
    0
  );

  const totalDifference = items.reduce(
    (sum, item) =>
      sum + Number(item.difference || 0),
    0
  );

  const itemsWithDifference =
    items.filter(
      (item) =>
        Number(item.difference || 0) !== 0
    ).length;

  return (
    <div className="
      min-h-screen
      bg-[#F6F8F7]
      p-4
      md:p-6
      lg:p-8
    ">

      {/* HEADER */}
      <div className="mb-6">

        <button
          onClick={() =>
            router.push(
              "/laporan/stock-opname"
            )
          }
          className="
            mb-5
            inline-flex
            items-center
            gap-2
            text-sm
            font-semibold
            text-[#497F70]
            transition
            hover:text-[#3d6c5f]
          "
        >
          <ArrowLeft size={17} />

          Kembali ke Laporan Stock Opname
        </button>

        <div className="
          flex
          flex-col
          gap-4
          lg:flex-row
          lg:items-center
          lg:justify-between
        ">

          <div className="
            flex
            items-center
            gap-3
          ">

            <div className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-[#497F70]
              text-white
              shadow-sm
            ">
              <ClipboardCheck size={22} />
            </div>

            <div>

              <h1 className="
                text-2xl
                font-bold
                text-[#1F2937]
              ">
                Detail Stock Opname
              </h1>

              <p className="
                mt-1
                text-sm
                text-gray-500
              ">
                Detail pemeriksaan stok fisik gudang
              </p>

            </div>

          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              border-gray-200
              bg-white
              px-4
              py-2.5
              text-sm
              font-medium
              text-gray-700
              shadow-sm
              transition
              hover:bg-gray-50
              disabled:opacity-50
            "
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>

        </div>

      </div>


      {/* INFORMATION */}
      <div className="
        mb-6
        rounded-2xl
        border
        border-gray-100
        bg-white
        p-5
        shadow-sm
      ">

        <div className="
          grid
          grid-cols-1
          gap-5
          md:grid-cols-2
          xl:grid-cols-4
        ">

          <div>

            <p className="
              text-xs
              font-medium
              uppercase
              tracking-wide
              text-gray-400
            ">
              Kode Stock Opname
            </p>

            <p className="
              mt-1
              text-lg
              font-bold
              text-gray-900
            ">
              {data.code}
            </p>

          </div>


          <div>

            <p className="
              text-xs
              font-medium
              uppercase
              tracking-wide
              text-gray-400
            ">
              Tanggal
            </p>

            <div className="
              mt-1
              flex
              items-center
              gap-2
              text-gray-800
            ">

              <CalendarDays
                size={17}
                className="text-[#497F70]"
              />

              <span className="font-medium">
                {formatDate(data.date)}
              </span>

            </div>

          </div>


          <div>

            <p className="
              text-xs
              font-medium
              uppercase
              tracking-wide
              text-gray-400
            ">
              Status
            </p>

            <div className="mt-2">

              <span
                className={`
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-full
                  border
                  px-3
                  py-1
                  text-xs
                  font-semibold
                  ${getStatusClass(data.status)}
                `}
              >
                {getStatusIcon(data.status)}

                {getStatusLabel(data.status)}
              </span>

            </div>

          </div>


          <div>

            <p className="
              text-xs
              font-medium
              uppercase
              tracking-wide
              text-gray-400
            ">
              Jumlah Item
            </p>

            <div className="
              mt-1
              flex
              items-center
              gap-2
            ">

              <Package
                size={18}
                className="text-[#497F70]"
              />

              <span className="
                text-lg
                font-bold
                text-gray-900
              ">
                {formatNumber(totalItem)}
              </span>

            </div>

          </div>

        </div>

      </div>


      {/* SUMMARY */}
      <div className="
        mb-6
        grid
        grid-cols-1
        gap-4
        sm:grid-cols-2
        xl:grid-cols-4
      ">

        <div className="
          rounded-2xl
          border
          border-gray-100
          bg-white
          p-5
          shadow-sm
        ">

          <p className="
            text-sm
            font-medium
            text-gray-500
          ">
            Total System Qty
          </p>

          <p className="
            mt-2
            text-2xl
            font-bold
            text-gray-900
          ">
            {formatNumber(totalSystemQty)}
          </p>

          <p className="
            mt-2
            text-xs
            text-gray-400
          ">
            Jumlah stok menurut sistem
          </p>

        </div>


        <div className="
          rounded-2xl
          border
          border-gray-100
          bg-white
          p-5
          shadow-sm
        ">

          <p className="
            text-sm
            font-medium
            text-gray-500
          ">
            Total Fisik
          </p>

          <p className="
            mt-2
            text-2xl
            font-bold
            text-gray-900
          ">
            {formatNumber(totalPhysicalQty)}
          </p>

          <p className="
            mt-2
            text-xs
            text-gray-400
          ">
            Hasil pemeriksaan fisik
          </p>

        </div>


        <div className="
          rounded-2xl
          border
          border-gray-100
          bg-white
          p-5
          shadow-sm
        ">

          <p className="
            text-sm
            font-medium
            text-gray-500
          ">
            Total Selisih
          </p>

          <p
            className={`
              mt-2
              text-2xl
              font-bold
              ${
                totalDifference === 0
                  ? "text-green-600"
                  : totalDifference > 0
                    ? "text-blue-600"
                    : "text-red-600"
              }
            `}
          >
            {totalDifference > 0
              ? "+"
              : ""}

            {formatNumber(
              totalDifference
            )}
          </p>

          <p className="
            mt-2
            text-xs
            text-gray-400
          ">
            Selisih fisik terhadap sistem
          </p>

        </div>


        <div className="
          rounded-2xl
          border
          border-gray-100
          bg-white
          p-5
          shadow-sm
        ">

          <p className="
            text-sm
            font-medium
            text-gray-500
          ">
            Item Berselisih
          </p>

          <p className="
            mt-2
            text-2xl
            font-bold
            text-gray-900
          ">
            {formatNumber(
              itemsWithDifference
            )}
          </p>

          <p className="
            mt-2
            text-xs
            text-gray-400
          ">
            Item dengan selisih stok
          </p>

        </div>

      </div>


      {/* TABLE */}
      <div className="
        overflow-hidden
        rounded-2xl
        border
        border-gray-100
        bg-white
        shadow-sm
      ">

        <div className="
          border-b
          border-gray-100
          px-5
          py-4
        ">

          <div className="
            flex
            items-center
            justify-between
          ">

            <div>

              <h2 className="
                font-semibold
                text-gray-900
              ">
                Detail Barang
              </h2>

              <p className="
                mt-1
                text-xs
                text-gray-500
              ">
                Daftar hasil pemeriksaan stok setiap barang
              </p>

            </div>

            <div className="
              rounded-lg
              bg-[#EDF5F2]
              px-3
              py-1.5
              text-xs
              font-semibold
              text-[#497F70]
            ">
              {formatNumber(totalItem)} Item
            </div>

          </div>

        </div>


        <div className="overflow-x-auto">

          <table className="min-w-full text-sm">

            <thead>

              <tr className="
                border-b
                border-gray-100
                bg-gray-50
              ">

                <th className="
                  whitespace-nowrap
                  px-5
                  py-4
                  text-center
                  font-semibold
                  text-gray-600
                ">
                  No
                </th>

                <th className="
                  whitespace-nowrap
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-gray-600
                ">
                  Kode Barang
                </th>

                <th className="
                  whitespace-nowrap
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-gray-600
                ">
                  Nama Barang
                </th>

                <th className="
                  whitespace-nowrap
                  px-5
                  py-4
                  text-right
                  font-semibold
                  text-gray-600
                ">
                  System Qty
                </th>

                <th className="
                  whitespace-nowrap
                  px-5
                  py-4
                  text-right
                  font-semibold
                  text-gray-600
                ">
                  Fisik
                </th>

                <th className="
                  whitespace-nowrap
                  px-5
                  py-4
                  text-right
                  font-semibold
                  text-gray-600
                ">
                  Selisih
                </th>

                <th className="
                  whitespace-nowrap
                  px-5
                  py-4
                  text-center
                  font-semibold
                  text-gray-600
                ">
                  Status
                </th>

              </tr>

            </thead>


            <tbody>

              {items.length === 0 ? (

                <tr>

                  <td
                    colSpan={7}
                    className="
                      px-5
                      py-12
                      text-center
                    "
                  >

                    <div className="
                      flex
                      flex-col
                      items-center
                    ">

                      <div className="
                        mb-3
                        flex
                        h-12
                        w-12
                        items-center
                        justify-center
                        rounded-full
                        bg-gray-100
                        text-gray-400
                      ">
                        <Package size={22} />
                      </div>

                      <p className="
                        font-medium
                        text-gray-700
                      ">
                        Tidak ada detail barang
                      </p>

                      <p className="
                        mt-1
                        text-xs
                        text-gray-400
                      ">
                        Belum terdapat item pada stock opname ini
                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                items.map(
                  (item,index) => {

                    const difference =
                      Number(
                        item.difference || 0
                      );

                    return (
                      <tr
                        key={item.id}
                        className="
                          border-b
                          border-gray-100
                          transition
                          hover:bg-gray-50
                        "
                      >

                        <td className="
                          whitespace-nowrap
                          px-5
                          py-4
                          text-center
                          text-gray-500
                        ">
                          {index + 1}
                        </td>


                        <td className="
                          whitespace-nowrap
                          px-5
                          py-4
                          font-medium
                          text-gray-700
                        ">
                          {item.barang?.code ?? "-"}
                        </td>


                        <td className="
                          px-5
                          py-4
                        ">

                          <div className="
                            flex
                            items-center
                            gap-3
                          ">

                            <div className="
                              flex
                              h-9
                              w-9
                              shrink-0
                              items-center
                              justify-center
                              rounded-lg
                              bg-[#EDF5F2]
                              text-[#497F70]
                            ">
                              <Package size={17} />
                            </div>

                            <span className="
                              font-semibold
                              text-gray-900
                            ">
                              {item.barang?.name ?? "-"}
                            </span>

                          </div>

                        </td>


                        <td className="
                          whitespace-nowrap
                          px-5
                          py-4
                          text-right
                          font-medium
                          text-gray-700
                        ">
                          {formatNumber(
                            item.systemQty
                          )}
                        </td>


                        <td className="
                          whitespace-nowrap
                          px-5
                          py-4
                          text-right
                          font-medium
                          text-gray-700
                        ">
                          {formatNumber(
                            item.physicalQty
                          )}
                        </td>


                        <td className="
                          whitespace-nowrap
                          px-5
                          py-4
                          text-right
                        ">

                          <span
                            className={`
                              font-bold
                              ${
                                difference === 0
                                  ? "text-gray-500"
                                  : difference > 0
                                    ? "text-blue-600"
                                    : "text-red-600"
                              }
                            `}
                          >
                            {difference > 0
                              ? "+"
                              : ""}

                            {formatNumber(
                              difference
                            )}
                          </span>

                        </td>


                        <td className="
                          whitespace-nowrap
                          px-5
                          py-4
                          text-center
                        ">

                          {difference === 0 ? (

                            <span className="
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-full
                              border
                              border-green-200
                              bg-green-50
                              px-3
                              py-1
                              text-xs
                              font-semibold
                              text-green-700
                            ">
                              <CheckCircle2
                                size={14}
                              />

                              Sesuai
                            </span>

                          ) : difference > 0 ? (

                            <span className="
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-full
                              border
                              border-blue-200
                              bg-blue-50
                              px-3
                              py-1
                              text-xs
                              font-semibold
                              text-blue-700
                            ">
                              <AlertTriangle
                                size={14}
                              />

                              Lebih
                            </span>

                          ) : (

                            <span className="
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-full
                              border
                              border-red-200
                              bg-red-50
                              px-3
                              py-1
                              text-xs
                              font-semibold
                              text-red-700
                            ">
                              <AlertTriangle
                                size={14}
                              />

                              Kurang
                            </span>

                          )}

                        </td>

                      </tr>
                    );
                  }
                )

              )}

            </tbody>


            {items.length > 0 && (

              <tfoot>

                <tr className="bg-gray-50">

                  <td
                    colSpan={3}
                    className="
                      px-5
                      py-4
                      text-right
                      font-semibold
                      text-gray-700
                    "
                  >
                    TOTAL
                  </td>

                  <td className="
                    px-5
                    py-4
                    text-right
                    font-bold
                    text-gray-900
                  ">
                    {formatNumber(
                      totalSystemQty
                    )}
                  </td>

                  <td className="
                    px-5
                    py-4
                    text-right
                    font-bold
                    text-gray-900
                  ">
                    {formatNumber(
                      totalPhysicalQty
                    )}
                  </td>

                  <td className="
                    px-5
                    py-4
                    text-right
                    font-bold
                    text-[#497F70]
                  ">
                    {totalDifference > 0
                      ? "+"
                      : ""}

                    {formatNumber(
                      totalDifference
                    )}
                  </td>

                  <td />

                </tr>

              </tfoot>

            )}

          </table>

        </div>

      </div>

    </div>
  );
}