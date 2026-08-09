"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function StockOpnamePage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // =================================
  // LOAD DATA
  // =================================

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch("/api/stock-opname", {
        cache: "no-store",
      });

      const json = await res.json();

      console.log("STOCK OPNAME LIST:", json);

      if (json.success) {
        setData(json.data ?? []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error(
        "LOAD STOCK OPNAME ERROR:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // =================================
  // BUAT STOCK OPNAME
  // =================================

  async function buatOpname() {
    const ok = confirm(
      "Buat Stock Opname baru?\n\nSemua barang aktif akan dimasukkan ke dalam Stock Opname."
    );

    if (!ok) return;

    try {
      const res = await fetch("/api/stock-opname", {
        method: "POST",
      });

      const json = await res.json();

      console.log(
        "CREATE STOCK OPNAME:",
        json
      );

      if (json.success) {
        alert(
          "Stock Opname berhasil dibuat"
        );

        await loadData();
      } else {
        alert(
          json.message ||
            "Gagal membuat Stock Opname"
        );
      }
    } catch (error) {
      console.error(
        "CREATE STOCK OPNAME ERROR:",
        error
      );

      alert(
        "Gagal membuat Stock Opname"
      );
    }
  }

  // =================================
  // HAPUS STOCK OPNAME
  // =================================

  async function hapusOpname(
    id: number,
    code: string
  ) {
    const ok = confirm(
      `Hapus Stock Opname ${code}?\n\nData item Stock Opname juga akan ikut dihapus.\n\nTindakan ini tidak dapat dibatalkan.`
    );

    if (!ok) return;

    try {
      setDeletingId(id);

      const res = await fetch(
        `/api/stock-opname/${id}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      console.log(
        "DELETE STOCK OPNAME:",
        json
      );

      if (json.success) {
        alert(
          "Stock Opname berhasil dihapus"
        );

        await loadData();
      } else {
        alert(
          json.message ||
            "Gagal menghapus Stock Opname"
        );
      }
    } catch (error) {
      console.error(
        "DELETE STOCK OPNAME ERROR:",
        error
      );

      alert(
        "Gagal menghapus Stock Opname"
      );
    } finally {
      setDeletingId(null);
    }
  }

  // =================================
  // RENDER
  // =================================

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">

      {/* HEADER */}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Stock Opname
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Pemeriksaan dan penyesuaian stok fisik gudang
          </p>
        </div>

        <button
          onClick={buatOpname}
          className="
            inline-flex
            items-center
            justify-center
            rounded-lg
            bg-blue-600
            px-4
            py-2.5
            text-sm
            font-semibold
            text-white
            shadow-sm
            transition
            hover:bg-blue-700
            active:scale-[0.98]
          "
        >
          + Buat Opname
        </button>

      </div>


      {/* SUMMARY */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="text-sm text-slate-500">
            Total Opname
          </div>

          <div className="mt-1 text-2xl font-bold text-slate-900">
            {data.length}
          </div>

        </div>


        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="text-sm text-slate-500">
            Belum Disahkan
          </div>

          <div className="mt-1 text-2xl font-bold text-amber-600">
            {
              data.filter(
                (item) =>
                  item.status !== "APPROVED"
              ).length
            }
          </div>

        </div>


        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="text-sm text-slate-500">
            Sudah Disahkan
          </div>

          <div className="mt-1 text-2xl font-bold text-emerald-600">
            {
              data.filter(
                (item) =>
                  item.status === "APPROVED"
              ).length
            }
          </div>

        </div>

      </div>


      {/* TABLE */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="overflow-x-auto">

          <table className="w-full min-w-[800px]">

            <thead>

              <tr className="border-b border-slate-200 bg-slate-50">

                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  No
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Kode
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tanggal
                </th>

                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>

                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Jumlah Item
                </th>

                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Aksi
                </th>

              </tr>

            </thead>


            <tbody>

              {/* LOADING */}

              {loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center"
                  >

                    <div className="flex flex-col items-center justify-center">

                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

                      <p className="mt-3 text-sm text-slate-500">
                        Memuat Stock Opname...
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
                      colSpan={6}
                      className="px-4 py-12 text-center"
                    >

                      <div className="mx-auto max-w-md">

                        <div className="text-4xl">
                          📋
                        </div>

                        <h3 className="mt-3 font-semibold text-slate-800">
                          Belum ada Stock Opname
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Buat Stock Opname baru untuk mulai melakukan pemeriksaan stok.
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

                    const approved =
                      item.status ===
                      "APPROVED";

                    const deleting =
                      deletingId ===
                      item.id;

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

                        <td className="px-4 py-3 text-center text-sm text-slate-500">
                          {index + 1}
                        </td>


                        {/* KODE */}

                        <td className="px-4 py-3">

                          <div className="font-semibold text-slate-800">
                            {item.code}
                          </div>

                        </td>


                        {/* TANGGAL */}

                        <td className="px-4 py-3 text-sm text-slate-600">

                          {item.date
                            ? new Date(
                                item.date
                              ).toLocaleDateString(
                                "id-ID",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                }
                              )
                            : "-"}

                        </td>


                        {/* STATUS */}

                        <td className="px-4 py-3 text-center">

                          <span
                            className={`
                              inline-flex
                              items-center
                              rounded-full
                              px-3
                              py-1
                              text-xs
                              font-semibold
                              ${
                                approved
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }
                            `}
                          >

                            <span
                              className={`
                                mr-1.5
                                h-1.5
                                w-1.5
                                rounded-full
                                ${
                                  approved
                                    ? "bg-emerald-500"
                                    : "bg-amber-500"
                                }
                              `}
                            />

                            {approved
                              ? "APPROVED"
                              : "COUNTING"}

                          </span>

                        </td>


                        {/* TOTAL ITEM */}

                        <td className="px-4 py-3 text-center text-sm font-medium text-slate-700">

                          {item.totalItem ??
                            0}

                        </td>


                        {/* AKSI */}

                        <td className="px-4 py-3">

                          <div className="flex items-center justify-center gap-2">

                            <Link
                              href={`/stock-opname/${item.id}`}
                              className="
                                inline-flex
                                items-center
                                rounded-lg
                                bg-blue-600
                                px-3
                                py-1.5
                                text-xs
                                font-semibold
                                text-white
                                transition
                                hover:bg-blue-700
                              "
                            >
                              Detail
                            </Link>


                            {/* DELETE
                                hanya untuk
                                COUNTING */}

                            {!approved && (
                              <button
                                type="button"
                                disabled={
                                  deleting
                                }
                                onClick={() =>
                                  hapusOpname(
                                    item.id,
                                    item.code
                                  )
                                }
                                className="
                                  inline-flex
                                  items-center
                                  rounded-lg
                                  bg-red-600
                                  px-3
                                  py-1.5
                                  text-xs
                                  font-semibold
                                  text-white
                                  transition
                                  hover:bg-red-700
                                  disabled:cursor-not-allowed
                                  disabled:opacity-50
                                "
                              >

                                {deleting
                                  ? "Menghapus..."
                                  : "Hapus"}

                              </button>
                            )}

                          </div>

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