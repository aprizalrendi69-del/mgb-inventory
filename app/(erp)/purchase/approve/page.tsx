"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Eye,
  RefreshCw,
  FileText,
  Store,
  Warehouse,
} from "lucide-react";

type PurchaseItem = {
  id: number;
  barangId: number;
  qty: number;
  price: number;
  subtotal: number;
  barang?: {
    id: number;
    code?: string;
    name?: string;
    unit?: string;
  };
};

type PurchaseData = {
  id: number;
  number: string;
  status: string;
  purchaseDate?: string;
  total?: number;

  source?: "PUSAT" | "OUTLET";

  destinationType?: "PUSAT" | "OUTLET";
  destinationId?: number | null;
  destinationName?: string | null;
  destinationCode?: string | null;

  supplier?: {
    id: number;
    name: string;
  };

  outlet?: {
    id: number;
    code: string;
    name: string;
  };

  items?: PurchaseItem[];
};

export default function ApprovePage() {
  const [data, setData] = useState<PurchaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] =
    useState<number | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);

      /*
       * =====================================================
       * PURCHASE API
       *
       * API ini sekarang mengembalikan:
       *
       * - Purchase Pusat
       * - Purchase Outlet
       *
       * Untuk user pusat.
       * =====================================================
       */

      const res = await fetch("/api/purchase", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil Purchase Order"
        );
      }

      /*
       * =====================================================
       * HANYA DRAFT
       * =====================================================
       */

      const draftData = (json.data || []).filter(
        (item: PurchaseData) =>
          item.status === "DRAFT"
      );

      setData(draftData);
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

  /*
   * =======================================================
   * APPROVE PURCHASE
   * =======================================================
   *
   * PUSAT
   * -> /api/purchase/[id]/approve
   *
   * OUTLET
   * -> /api/outlet/purchase/[id]/approve
   *
   * Sesuaikan path endpoint outlet jika folder API kamu
   * menggunakan nama route yang berbeda.
   * =======================================================
   */

  async function approvePurchase(
    purchase: PurchaseData
  ) {
    if (!purchase?.id) return;

    const isOutlet =
      purchase.source === "OUTLET" ||
      purchase.destinationType === "OUTLET";

    const destination =
      isOutlet
        ? purchase.outlet?.name ||
          purchase.destinationName ||
          "-"
        : "Gudang Pusat";

    const yakin = confirm(
      `Approve ${
        isOutlet
          ? "Purchase Order Outlet"
          : "Purchase Order"
      } ${purchase.number}?\n\n` +
        `Supplier: ${
          purchase.supplier?.name || "-"
        }\n` +
        `Tujuan: ${destination}\n` +
        `Total: Rp ${Number(
          purchase.total || 0
        ).toLocaleString("id-ID")}\n\n` +
        `Setelah diapprove, Purchase Order tidak dapat diedit atau dihapus.`
    );

    if (!yakin) return;

    try {
      setApprovingId(purchase.id);

      /*
       * ===================================================
       * ENDPOINT
       * ===================================================
       */

      const endpoint = isOutlet
        ? `/api/outlet/purchase/${purchase.id}/approve`
        : `/api/purchase/${purchase.id}/approve`;

      const res = await fetch(endpoint, {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal melakukan approve Purchase Order"
        );
      }

      alert(
        `${
          isOutlet
            ? "Purchase Order Outlet"
            : "Purchase Order"
        } ${purchase.number} berhasil diapprove.`
      );

      /*
       * ===================================================
       * HAPUS DARI LIST APPROVAL
       * ===================================================
       */

      setData((prev) =>
        prev.filter(
          (item) =>
            item.id !== purchase.id ||
            item.source !== purchase.source
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

  /*
   * =======================================================
   * SUMMARY
   * =======================================================
   */

  const totalPurchase = useMemo(() => {
    return data.reduce(
      (total, item) =>
        total + Number(item.total || 0),
      0
    );
  }, [data]);

  const totalPusat = useMemo(() => {
    return data.filter(
      (item) =>
        item.source === "PUSAT" ||
        item.destinationType === "PUSAT"
    ).length;
  }, [data]);

  const totalOutlet = useMemo(() => {
    return data.filter(
      (item) =>
        item.source === "OUTLET" ||
        item.destinationType === "OUTLET"
    ).length;
  }, [data]);

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">
      <div className="mx-auto max-w-7xl">

        {/* =================================================
            HEADER
        ================================================= */}

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

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {/* TOTAL PO */}

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

          {/* PUSAT */}

          <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-gray-500">
                  PO Pusat
                </p>

                <p className="mt-1 text-2xl font-bold text-[#18352D]">
                  {totalPusat}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <Warehouse size={21} />
              </div>

            </div>
          </div>

          {/* OUTLET */}

          <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-gray-500">
                  PO Outlet
                </p>

                <p className="mt-1 text-2xl font-bold text-[#18352D]">
                  {totalOutlet}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Store size={21} />
              </div>

            </div>
          </div>

          {/* TOTAL NILAI */}

          <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-gray-500">
                  Nilai Purchase
                </p>

                <p className="mt-1 text-xl font-bold text-[#18352D]">
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

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

          <div className="overflow-x-auto">

            <table className="min-w-[1150px] w-full text-sm">

              <thead className="bg-[#F5F8F6]">
                <tr className="border-b border-[#E5ECE9]">

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    No. PO
                  </th>

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Jenis
                  </th>

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Tujuan
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

                {/* =================================================
                    LOADING
                ================================================= */}

                {loading && (
                  <tr>
                    <td
                      colSpan={9}
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

                {/* =================================================
                    EMPTY
                ================================================= */}

                {!loading &&
                  data.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
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

                {/* =================================================
                    DATA
                ================================================= */}

                {!loading &&
                  data.map((item) => {

                    const isOutlet =
                      item.source === "OUTLET" ||
                      item.destinationType ===
                        "OUTLET";

                    const destination =
                      isOutlet
                        ? item.outlet?.name ||
                          item.destinationName ||
                          "-"
                        : "Gudang Pusat";

                    const destinationCode =
                      isOutlet
                        ? item.outlet?.code ||
                          item.destinationCode ||
                          ""
                        : "";

                    return (
                      <tr
                        key={`${item.source}-${item.id}`}
                        className="border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
                      >

                        {/* NO PO */}

                        <td className="px-5 py-4 font-semibold text-[#18352D]">
                          {item.number}
                        </td>

                        {/* JENIS */}

                        <td className="px-5 py-4">

                          {isOutlet ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                              <Store size={13} />
                              OUTLET
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF3EF] px-3 py-1.5 text-xs font-semibold text-[#497F70]">
                              <Warehouse size={13} />
                              PUSAT
                            </span>
                          )}

                        </td>

                        {/* TUJUAN */}

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {destination}
                          </div>

                          {destinationCode && (
                            <div className="mt-0.5 text-xs text-gray-400">
                              {destinationCode}
                            </div>
                          )}

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
                              href={
                                isOutlet
                                  ? `/outlet/purchase/${item.id}`
                                  : `/purchase/${item.id}`
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5E5DC] bg-white px-3 py-2 text-xs font-semibold text-[#35564C] transition hover:bg-[#F5F8F6]"
                            >
                              <Eye size={14} />
                              Detail
                            </Link>

                            <button
                              type="button"
                              onClick={() =>
                                approvePurchase(
                                  item
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
                    );
                  })}

              </tbody>

            </table>

          </div>

        </div>

      </div>
    </div>
  );
}