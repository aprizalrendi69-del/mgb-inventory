"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  RefreshCw,
  ArrowRightLeft,
} from "lucide-react";

export default function MutasiStockPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);

      const res = await fetch("/api/mutasi-stock", {
        cache: "no-store",
      });

      const result = await res.json();

      console.log("MUTASI STOCK:", result);

      if (result.success) {
        setData(result.data ?? []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error(
        "LOAD MUTASI STOCK ERROR:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totalMutasi = data.length;

  const totalMasuk = data.filter(
    (item) =>
      item.type === "IN" ||
      item.type === "MASUK"
  ).length;

  const totalKeluar = data.filter(
    (item) =>
      item.type === "OUT" ||
      item.type === "KELUAR"
  ).length;

  const totalQty = data.reduce(
    (total, item) =>
      total + Number(item.qty ?? 0),
    0
  );

  function isMasuk(type: string) {
    return (
      type === "IN" ||
      type === "MASUK"
    );
  }

  function formatDate(value: any) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  function formatNumber(value: any) {
    return Number(value ?? 0).toLocaleString(
      "id-ID"
    );
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">

      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div>
          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
              <ArrowRightLeft
                size={22}
                className="text-blue-600"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Mutasi Stock
              </h1>

              <p className="mt-0.5 text-sm text-slate-500">
                Riwayat perubahan dan pergerakan stok barang
              </p>
            </div>

          </div>
        </div>


        {/* REFRESH */}
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="
            inline-flex
            items-center
            justify-center
            gap-2
            rounded-xl
            border
            border-slate-200
            bg-white
            px-4
            py-2.5
            text-sm
            font-semibold
            text-slate-700
            shadow-sm
            transition
            hover:bg-slate-50
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >

          <RefreshCw
            size={17}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          Refresh

        </button>

      </div>


      {/* SUMMARY */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* TOTAL MUTASI */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Total Mutasi
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatNumber(
                  totalMutasi
                )}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">

              <ArrowRightLeft
                size={21}
                className="text-blue-600"
              />

            </div>

          </div>

        </div>


        {/* BARANG MASUK */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Barang Masuk
              </p>

              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {formatNumber(
                  totalMasuk
                )}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">

              <ArrowDownToLine
                size={21}
                className="text-emerald-600"
              />

            </div>

          </div>

        </div>


        {/* BARANG KELUAR */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Barang Keluar
              </p>

              <p className="mt-1 text-2xl font-bold text-red-600">
                {formatNumber(
                  totalKeluar
                )}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100">

              <ArrowUpFromLine
                size={21}
                className="text-red-600"
              />

            </div>

          </div>

        </div>


        {/* TOTAL QTY */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Total Qty Mutasi
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatNumber(
                  totalQty
                )}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">

              <Boxes
                size={21}
                className="text-slate-600"
              />

            </div>

          </div>

        </div>

      </div>


      {/* TABLE CARD */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {/* TABLE HEADER */}
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">

          <div>

            <h2 className="font-semibold text-slate-800">
              Riwayat Mutasi Stock
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              Semua perubahan stok yang tercatat dalam sistem
            </p>

          </div>

          <div className="text-xs text-slate-500">
            {data.length} data
          </div>

        </div>


        {/* TABLE */}
        <div className="overflow-x-auto">

          <table className="w-full min-w-[1050px]">

            <thead>

              <tr className="border-b border-slate-200 bg-slate-50">

                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  No
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tanggal
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Barang
                </th>

                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Qty
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Stock Sebelum
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Stock Sesudah
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Referensi
                </th>

              </tr>

            </thead>


            <tbody>

              {/* LOADING */}
              {loading && (
                <tr>

                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center"
                  >

                    <div className="flex flex-col items-center justify-center">

                      <RefreshCw
                        size={25}
                        className="animate-spin text-blue-600"
                      />

                      <p className="mt-3 text-sm text-slate-500">
                        Memuat mutasi stock...
                      </p>

                    </div>

                  </td>

                </tr>
              )}


              {/* EMPTY */}
              {!loading &&
                data.length === 0 && (
                  <tr>

                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center"
                    >

                      <div className="mx-auto flex max-w-md flex-col items-center">

                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">

                          <ArrowRightLeft
                            size={28}
                            className="text-slate-400"
                          />

                        </div>

                        <h3 className="mt-4 font-semibold text-slate-700">
                          Belum ada mutasi stock
                        </h3>

                        <p className="mt-1 text-sm text-slate-400">
                          Riwayat perubahan stok akan muncul di sini.
                        </p>

                      </div>

                    </td>

                  </tr>
                )}


              {/* DATA */}
              {!loading &&
                data.map(
                  (
                    item,
                    index
                  ) => {

                    const masuk =
                      isMasuk(
                        item.type
                      );

                    return (
                      <tr
                        key={item.id}
                        className="
                          border-b
                          border-slate-100
                          transition
                          hover:bg-slate-50
                        "
                      >

                        {/* NO */}
                        <td className="px-4 py-4 text-center text-sm text-slate-400">
                          {index + 1}
                        </td>


                        {/* TANGGAL */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                          {formatDate(
                            item.createdAt
                          )}
                        </td>


                        {/* BARANG */}
                        <td className="px-4 py-4">

                          <div className="font-medium text-slate-700">
                            {item.barang?.name ??
                              "-"}
                          </div>

                          {item.barang?.code && (
                            <div className="mt-0.5 text-xs text-slate-400">
                              {item.barang.code}
                            </div>
                          )}

                        </td>


                        {/* TYPE */}
                        <td className="px-4 py-4 text-center">

                          <span
                            className={`
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-full
                              px-3
                              py-1
                              text-xs
                              font-semibold
                              ${
                                masuk
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                              }
                            `}
                          >

                            {masuk ? (
                              <ArrowDownToLine
                                size={13}
                              />
                            ) : (
                              <ArrowUpFromLine
                                size={13}
                              />
                            )}

                            {masuk
                              ? "BARANG MASUK"
                              : "BARANG KELUAR"}

                          </span>

                        </td>


                        {/* QTY */}
                        <td
                          className={`
                            px-4
                            py-4
                            text-right
                            font-semibold
                            ${
                              masuk
                                ? "text-emerald-600"
                                : "text-red-600"
                            }
                          `}
                        >

                          {masuk
                            ? "+"
                            : "-"}

                          {formatNumber(
                            item.qty
                          )}

                        </td>


                        {/* STOCK BEFORE */}
                        <td className="px-4 py-4 text-right text-sm text-slate-600">
                          {formatNumber(
                            item.stockBefore
                          )}
                        </td>


                        {/* STOCK AFTER */}
                        <td className="px-4 py-4 text-right">

                          <span className="font-semibold text-slate-800">
                            {formatNumber(
                              item.stockAfter
                            )}
                          </span>

                        </td>


                        {/* REFERENCE */}
                        <td className="px-4 py-4">

                          {item.reference ? (
                            <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                              {item.reference}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">
                              -
                            </span>
                          )}

                        </td>

                      </tr>
                    );
                  }
                )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}