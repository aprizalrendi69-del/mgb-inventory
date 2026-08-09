"use client";

import { useEffect, useState } from "react";
import {
  PackageCheck,
  RefreshCw,
  Truck,
  Users,
  Boxes,
} from "lucide-react";

export default function PengirimanPage() {
  const [delivery, setDelivery] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch("/api/delivery-order", {
        cache: "no-store",
      });

      const json = await res.json();

      setDelivery(
        Array.isArray(json.data)
          ? json.data
          : []
      );
    } catch (error) {
      console.error(
        "LOAD DELIVERY ORDER ERROR:",
        error
      );

      setDelivery([]);
    } finally {
      setLoading(false);
    }
  }

  async function approve(id: number) {
    if (!confirm("Release Delivery Order ini?")) {
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
        `/api/delivery-order/${id}/approve`,
        {
          method: "PUT",
        }
      );

      const json = await res.json();

      if (json.success) {
        alert(
          json.message ||
            "Delivery Order berhasil di-release"
        );

        await loadData();
      } else {
        alert(
          json.message ||
            "Gagal release Delivery Order"
        );
      }
    } catch (error) {
      console.error(
        "APPROVE DELIVERY ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat release Delivery Order"
      );
    } finally {
      setLoading(false);
    }
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

  function StatusBadge({
    status,
  }: {
    status: string;
  }) {
    const isReleased =
      status === "RELEASED";

    const isDraft =
      status === "DRAFT";

    return (
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
            isReleased
              ? "bg-emerald-100 text-emerald-700"
              : isDraft
              ? "bg-amber-100 text-amber-700"
              : "bg-slate-100 text-slate-600"
          }
        `}
      >
        <span
          className={`
            h-1.5
            w-1.5
            rounded-full
            ${
              isReleased
                ? "bg-emerald-500"
                : isDraft
                ? "bg-amber-500"
                : "bg-slate-400"
            }
          `}
        />

        {status || "UNKNOWN"}
      </span>
    );
  }

  const totalDelivery = delivery.length;

  const totalDraft = delivery.filter(
    (item) => item.status === "DRAFT"
  ).length;

  const totalReleased = delivery.filter(
    (item) => item.status === "RELEASED"
  ).length;

  const totalQty = delivery.reduce(
    (total, item) =>
      total + Number(item.totalQty || 0),
    0
  );

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">

      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div>
          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
              <Truck
                size={22}
                className="text-blue-600"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Delivery Order
              </h1>

              <p className="mt-0.5 text-sm text-slate-500">
                Kelola pengiriman barang kepada customer
              </p>
            </div>

          </div>
        </div>


        {/* REFRESH */}
        <button
          type="button"
          onClick={loadData}
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

        {/* TOTAL */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Total Delivery
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {totalDelivery}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
              <Truck
                size={21}
                className="text-blue-600"
              />
            </div>

          </div>

        </div>


        {/* DRAFT */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Draft
              </p>

              <p className="mt-1 text-2xl font-bold text-amber-600">
                {totalDraft}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
              <PackageCheck
                size={21}
                className="text-amber-600"
              />
            </div>

          </div>

        </div>


        {/* RELEASED */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Released
              </p>

              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {totalReleased}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
              <PackageCheck
                size={21}
                className="text-emerald-600"
              />
            </div>

          </div>

        </div>


        {/* TOTAL QTY */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Total Qty
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {totalQty.toLocaleString(
                  "id-ID"
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
              Daftar Delivery Order
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              Daftar pengiriman barang yang tersedia
            </p>

          </div>

          <div className="text-xs text-slate-500">
            {delivery.length} data
          </div>

        </div>


        {/* TABLE */}
        <div className="overflow-x-auto">

          <table className="w-full min-w-[900px]">

            <thead>

              <tr className="border-b border-slate-200 bg-slate-50">

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nomor
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tanggal
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Qty
                </th>

                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>

                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Aksi
                </th>

              </tr>

            </thead>


            <tbody>

              {/* LOADING */}
              {loading && delivery.length === 0 && (
                <tr>

                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center"
                  >

                    <div className="flex flex-col items-center justify-center">

                      <RefreshCw
                        size={25}
                        className="animate-spin text-blue-600"
                      />

                      <p className="mt-3 text-sm text-slate-500">
                        Memuat Delivery Order...
                      </p>

                    </div>

                  </td>

                </tr>
              )}


              {/* EMPTY */}
              {!loading &&
                delivery.length === 0 && (
                  <tr>

                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center"
                    >

                      <div className="mx-auto flex max-w-md flex-col items-center">

                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">

                          <Truck
                            size={28}
                            className="text-slate-400"
                          />

                        </div>

                        <h3 className="mt-4 font-semibold text-slate-700">
                          Belum ada Delivery Order
                        </h3>

                        <p className="mt-1 text-sm text-slate-400">
                          Delivery Order yang dibuat akan muncul di sini.
                        </p>

                      </div>

                    </td>

                  </tr>
                )}


              {/* DATA */}
              {!loading &&
                delivery.map(
                  (d: any) => (

                    <tr
                      key={d.id}
                      className="
                        border-b
                        border-slate-100
                        transition
                        hover:bg-slate-50
                      "
                    >

                      {/* NOMOR */}
                      <td className="px-4 py-4">

                        <div className="font-semibold text-slate-800">
                          {d.number || "-"}
                        </div>

                      </td>


                      {/* TANGGAL */}
                      <td className="px-4 py-4 text-sm text-slate-600">

                        {formatDate(
                          d.deliveryDate
                        )}

                      </td>


                      {/* CUSTOMER */}
                      <td className="px-4 py-4">

                        <div className="flex items-center gap-3">

                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">

                            <Users
                              size={17}
                              className="text-slate-500"
                            />

                          </div>

                          <div>

                            <div className="font-medium text-slate-700">
                              {d.customer?.name ||
                                "-"}
                            </div>

                            {d.customer?.code && (
                              <div className="mt-0.5 text-xs text-slate-400">
                                {d.customer.code}
                              </div>
                            )}

                          </div>

                        </div>

                      </td>


                      {/* QTY */}
                      <td className="px-4 py-4 text-right">

                        <span className="font-semibold text-slate-700">
                          {Number(
                            d.totalQty || 0
                          ).toLocaleString(
                            "id-ID"
                          )}
                        </span>

                      </td>


                      {/* STATUS */}
                      <td className="px-4 py-4 text-center">

                        <StatusBadge
                          status={
                            d.status
                          }
                        />

                      </td>


                      {/* ACTION */}
                      <td className="px-4 py-4 text-center">

                        {d.status ===
                        "DRAFT" ? (

                          <button
                            type="button"
                            disabled={loading}
                            onClick={() =>
                              approve(
                                d.id
                              )
                            }
                            className="
                              inline-flex
                              items-center
                              justify-center
                              rounded-lg
                              bg-blue-600
                              px-4
                              py-2
                              text-xs
                              font-semibold
                              text-white
                              shadow-sm
                              transition
                              hover:bg-blue-700
                              disabled:cursor-not-allowed
                              disabled:opacity-50
                            "
                          >
                            Release
                          </button>

                        ) : (

                          <span className="text-xs text-slate-400">
                            -
                          </span>

                        )}

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