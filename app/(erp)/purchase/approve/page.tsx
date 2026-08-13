"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Eye,
  RefreshCw,
  FileText,
} from "lucide-react";

export default function ApprovePage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] =
    useState<number | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);

      const res = await fetch("/api/purchase", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        /*
         * Purchase Approve hanya menampilkan
         * PO yang masih DRAFT.
         */
        setData(
          (json.data || []).filter(
            (item: any) =>
              item.status === "DRAFT"
          )
        );
      } else {
        setData([]);
      }
    } catch (error) {
      console.error(
        "LOAD PURCHASE APPROVE ERROR:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  async function approvePurchase(id: number) {
    const purchase = data.find(
      (item) => item.id === id
    );

    if (!purchase) return;

    const yakin = confirm(
      `Approve Purchase Order ${purchase.number}?\n\n` +
        `Supplier: ${
          purchase.supplier?.name || "-"
        }\n` +
        `Total: Rp ${Number(
          purchase.total || 0
        ).toLocaleString("id-ID")}\n\n` +
        `Setelah diapprove, Purchase Order tidak dapat diedit atau dihapus.`
    );

    if (!yakin) return;

    try {
      setApprovingId(id);

      const res = await fetch(
        `/api/purchase/${id}/approve`,
        {
          method: "POST",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal melakukan approve Purchase Order"
        );
      }

      alert(
        `Purchase Order ${purchase.number} berhasil diapprove.`
      );

      /*
       * Setelah APPROVED,
       * keluarkan dari daftar approval.
       */
      setData((prev) =>
        prev.filter(
          (item) => item.id !== id
        )
      );
    } catch (error: any) {
      console.error(
        "APPROVE PURCHASE ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal melakukan approve Purchase Order"
      );
    } finally {
      setApprovingId(null);
    }
  }

  const totalPurchase = data.reduce(
    (total, item) =>
      total + Number(item.total || 0),
    0
  );

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div className="flex items-center gap-3">

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
              <CheckCircle2 size={23} />
            </div>

            <div>

              <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
                Purchase Approve
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Purchase Order yang menunggu persetujuan
              </p>

            </div>

          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-5 py-3 text-sm font-semibold text-[#35564C] shadow-sm transition hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-50"
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

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* JUMLAH PO */}

          <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  Menunggu Approval
                </p>

                <p className="mt-1 text-2xl font-bold text-[#18352D]">
                  {data.length}
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <FileText size={21} />
              </div>

            </div>

          </div>

          {/* TOTAL */}

          <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  Nilai Purchase
                </p>

                <p className="mt-1 text-2xl font-bold text-[#18352D]">
                  Rp{" "}
                  {totalPurchase.toLocaleString(
                    "id-ID"
                  )}
                </p>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <CheckCircle2 size={21} />
              </div>

            </div>

          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

          <div className="overflow-x-auto">

            <table className="min-w-[950px] w-full text-sm">

              <thead className="bg-[#F5F8F6]">

                <tr className="border-b border-[#E5ECE9]">

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    No. PO
                  </th>

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Supplier
                  </th>

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Tanggal
                  </th>

                  <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                    Item
                  </th>

                  <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                    Total
                  </th>

                  <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                    Status
                  </th>

                  <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                    Aksi
                  </th>

                </tr>

              </thead>

              <tbody>

                {/* LOADING */}

                {loading && (
                  <tr>

                    <td
                      colSpan={7}
                      className="px-5 py-14 text-center"
                    >

                      <div className="flex flex-col items-center gap-3 text-gray-500">

                        <RefreshCw
                          size={25}
                          className="animate-spin text-[#497F70]"
                        />

                        Memuat Purchase Order...

                      </div>

                    </td>

                  </tr>
                )}

                {/* EMPTY */}

                {!loading &&
                  data.length === 0 && (
                    <tr>

                      <td
                        colSpan={7}
                        className="px-5 py-14 text-center"
                      >

                        <div className="flex flex-col items-center">

                          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF3EF] text-[#497F70]">
                            <CheckCircle2
                              size={27}
                            />
                          </div>

                          <p className="font-semibold text-gray-700">
                            Tidak ada Purchase Order
                          </p>

                          <p className="mt-1 text-sm text-gray-400">
                            Tidak ada PO yang menunggu approval.
                          </p>

                        </div>

                      </td>

                    </tr>
                  )}

                {/* DATA */}

                {!loading &&
                  data.map(
                    (item: any) => (
                      <tr
                        key={item.id}
                        className="border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
                      >

                        {/* NO PO */}

                        <td className="px-5 py-4 font-semibold text-[#18352D]">
                          {item.number}
                        </td>

                        {/* SUPPLIER */}

                        <td className="px-5 py-4 text-gray-600">
                          {item.supplier?.name ||
                            "-"}
                        </td>

                        {/* TANGGAL */}

                        <td className="px-5 py-4 text-gray-600">
                          {item.purchaseDate
                            ? new Date(
                                item.purchaseDate
                              ).toLocaleDateString(
                                "id-ID"
                              )
                            : "-"}
                        </td>

                        {/* ITEM */}

                        <td className="px-5 py-4 text-center text-gray-600">
                          {item.items?.length ||
                            0}
                        </td>

                        {/* TOTAL */}

                        <td className="px-5 py-4 text-right font-semibold text-[#18352D]">
                          Rp{" "}
                          {Number(
                            item.total || 0
                          ).toLocaleString(
                            "id-ID"
                          )}
                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-4 text-center">

                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">

                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />

                            DRAFT

                          </span>

                        </td>

                        {/* AKSI */}

                        <td className="px-5 py-4">

                          <div className="flex items-center justify-center gap-2">

                            <Link
                              href={`/purchase/${item.id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5E5DC] bg-white px-3 py-2 text-xs font-semibold text-[#35564C] transition hover:bg-[#F5F8F6]"
                            >

                              <Eye size={14} />

                              Detail

                            </Link>

                            <button
                              type="button"
                              onClick={() =>
                                approvePurchase(
                                  item.id
                                )
                              }
                              disabled={
                                approvingId ===
                                item.id
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#497F70] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-50"
                            >

                              {approvingId ===
                              item.id ? (
                                <>
                                  <RefreshCw
                                    size={14}
                                    className="animate-spin"
                                  />

                                  Approving...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2
                                    size={14}
                                  />

                                  Approve
                                </>
                              )}

                            </button>

                          </div>

                        </td>

                      </tr>
                    )
                  )}

              </tbody>

            </table>

          </div>

        </div>

      </div>

    </div>
  );
}