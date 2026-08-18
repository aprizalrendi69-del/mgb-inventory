"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  PackageCheck,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

type Item = {
  id: number;
  qty: number;
  receivedQty?: number;
  price: number;
  subtotal: number;
  barang: {
    id: number;
    code: string;
    name: string;
    unit: string;
  };
};

type Detail = {
  id: number;
  sourceId: number;
  sumber: "PURCHASE" | "TRANSFER";
  nomor: string;
  tanggal: string;
  status: string;
  remarks?: string | null;

  outlet?: {
    id?: number;
    code: string;
    name: string;
  } | null;

  supplier?: {
    id?: number;
    code: string;
    name: string;
  } | null;

  purchase?: {
    id: number;
    number: string;
    status: string;
    purchaseDate?: string;
    remarks?: string | null;
  } | null;

  items: Item[];
};

export default function OutletBarangMasukDetailPage() {
  const params = useParams();
  const router = useRouter();

  const id = String(params.id);

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiving, setReceiving] = useState(false);

  // =====================================================
  // QTY DITERIMA MANUAL
  // =====================================================

  const [receivedQty, setReceivedQty] = useState<
    Record<number, number>
  >({});

  // =====================================================
  // LOAD DATA
  // =====================================================

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/outlet/barang-masuk/${id}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        console.error(
          "LOAD DETAIL BARANG MASUK:",
          json.message
        );

        setData(null);
        return;
      }

      const detail: Detail = json.data;

      // =================================================
      // SET QTY DITERIMA
      // =================================================

      const initialQty: Record<number, number> = {};

      detail.items.forEach((item) => {
        initialQty[item.id] =
          item.receivedQty ?? 0;
      });

      setReceivedQty(initialQty);

      setData(detail);
    } catch (error) {
      console.error(
        "LOAD DETAIL BARANG MASUK ERROR:",
        error
      );

      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // HANDLE RECEIVE
  // =====================================================

  async function handleReceive() {
    if (!data) return;

    // ===================================================
    // PURCHASE SUPPLIER
    //
    // Purchase hanya boleh diterima jika PO sudah
    // APPROVED.
    // ===================================================

    if (data.sumber === "PURCHASE") {
      const purchaseStatus =
        data.purchase?.status?.toUpperCase();

      if (purchaseStatus !== "APPROVED") {
        alert(
          "Purchase Order belum di-approve. Barang belum dapat diterima."
        );
        return;
      }
    }

    // ===================================================
    // SUDAH DITERIMA
    // ===================================================

    if (
      data.status === "RECEIVED" ||
      data.status === "SELESAI"
    ) {
      return;
    }

    // ===================================================
    // VALIDASI QTY TRANSFER
    // ===================================================

    if (data.sumber === "TRANSFER") {
      for (const item of data.items) {
        const qtyTerima = Number(
          receivedQty[item.id] ?? 0
        );

        if (qtyTerima < 0) {
          alert(
            `Qty diterima untuk ${item.barang.name} tidak boleh negatif.`
          );
          return;
        }

        if (qtyTerima > item.qty) {
          alert(
            `Qty diterima ${item.barang.name} tidak boleh lebih besar dari qty kirim (${item.qty}).`
          );
          return;
        }
      }
    }

    const confirmed = window.confirm(
      `Terima barang dari ${data.nomor}?\n\nStock outlet akan bertambah sesuai qty yang diterima.`
    );

    if (!confirmed) return;

    try {
      setReceiving(true);

      let url = "";
      let body: string | undefined;

      // =================================================
      // TRANSFER GUDANG
      // =================================================

      if (data.sumber === "TRANSFER") {
        url = `/api/outlet/barang-masuk/${id}/receive`;

        body = JSON.stringify({
          items: data.items.map((item) => ({
            id: item.id,
            receivedQty: Number(
              receivedQty[item.id] ?? 0
            ),
          })),
        });
      }

      // =================================================
      // PURCHASE SUPPLIER
      // =================================================

      else {
        url = `/api/outlet/barang-masuk/receive`;

        body = JSON.stringify({
          purchaseId: data.sourceId,
        });
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal menerima barang"
        );
      }

      alert(
        json.message ||
          "Barang berhasil diterima"
      );

      await loadData();
    } catch (error: any) {
      console.error(
        "RECEIVE BARANG ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal menerima barang"
      );
    } finally {
      setReceiving(false);
    }
  }

  // =====================================================
  // STATUS PENERIMAAN
  // =====================================================

  const alreadyReceived =
    data?.status === "RECEIVED" ||
    data?.status === "SELESAI";

  // =====================================================
  // STATUS PURCHASE ORDER
  // =====================================================

  const purchaseStatus =
    data?.purchase?.status?.toUpperCase();

  // =====================================================
  // BOLEH TERIMA BARANG?
  // =====================================================
  //
  // PURCHASE:
  //   hanya APPROVED
  //
  // TRANSFER:
  //   tetap boleh selama belum RECEIVED/SELESAI
  //
  // =====================================================

  const canReceive =
    data?.sumber === "PURCHASE"
      ? purchaseStatus === "APPROVED" &&
        !alreadyReceived
      : data?.sumber === "TRANSFER"
        ? !alreadyReceived
        : false;

  // =====================================================
  // TOTAL QTY
  // =====================================================

  const totalQty =
    data?.items?.reduce(
      (total, item) =>
        total +
        (data.sumber === "TRANSFER"
          ? Number(
              receivedQty[item.id] ?? 0
            )
          : item.qty),
      0
    ) ?? 0;

  // =====================================================
  // TOTAL VALUE
  // =====================================================

  const totalValue =
    data?.items?.reduce(
      (total, item) =>
        total +
        (data.sumber === "TRANSFER"
          ? Number(
              receivedQty[item.id] ?? 0
            ) * item.price
          : item.subtotal),
      0
    ) ?? 0;

  // =====================================================
  // SOURCE BADGE
  // =====================================================

  function sourceBadge() {
    if (data?.sumber === "PURCHASE") {
      return (
        <span className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
          Purchase Supplier
        </span>
      );
    }

    return (
      <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
        Kiriman Gudang
      </span>
    );
  }

  // =====================================================
  // STATUS BADGE
  // =====================================================

  function statusBadge() {
    const status =
      data?.status?.toUpperCase();

    if (
      status === "RECEIVED" ||
      status === "SELESAI"
    ) {
      return (
        <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
          Diterima
        </span>
      );
    }

    if (status === "PARTIAL") {
      return (
        <span className="inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
          Sebagian
        </span>
      );
    }

    return (
      <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
        Menunggu
      </span>
    );
  }

  // =====================================================
  // PURCHASE STATUS BADGE
  // =====================================================

  function purchaseStatusBadge() {
    if (!data?.purchase) return null;

    const status =
      data.purchase.status?.toUpperCase();

    if (status === "APPROVED") {
      return (
        <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
          Approved
        </span>
      );
    }

    if (status === "DRAFT") {
      return (
        <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
          Draft
        </span>
      );
    }

    if (status === "RECEIVED") {
      return (
        <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          Received
        </span>
      );
    }

    if (status === "CANCELLED") {
      return (
        <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
          Cancelled
        </span>
      );
    }

    return (
      <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
        {status || "-"}
      </span>
    );
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw
            size={20}
            className="animate-spin text-[#497F70]"
          />
          Memuat detail...
        </div>
      </div>
    );
  }

  // =====================================================
  // DATA NOT FOUND
  // =====================================================

  if (!data) {
    return (
      <div className="p-8">
        <button
          type="button"
          onClick={() =>
            router.push(
              "/outlet/barang-masuk"
            )
          }
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#497F70]"
        >
          <ArrowLeft size={17} />
          Kembali
        </button>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-10 text-center">
          <PackageCheck
            size={40}
            className="mx-auto mb-3 text-gray-300"
          />

          <p className="font-semibold text-gray-700">
            Data barang masuk tidak ditemukan
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* HEADER */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <button
            type="button"
            onClick={() =>
              router.push(
                "/outlet/barang-masuk"
              )
            }
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D5E5DC] bg-white text-gray-600 shadow-sm hover:bg-[#F5F8F6]"
          >
            <ArrowLeft size={19} />
          </button>

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <PackageCheck size={23} />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Detail Barang Masuk
            </h1>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-500">
                {data.nomor}
              </span>

              {sourceBadge()}
            </div>
          </div>

        </div>

        {/* =================================================
            ACTION BUTTON
            ================================================= */}

        <div className="flex flex-wrap gap-2">

          {/* ===============================================
              TOMBOL TERIMA BARANG

              PURCHASE:
              hanya muncul ketika PO APPROVED

              TRANSFER:
              muncul selama belum diterima
              =============================================== */}

          {canReceive && (
            <button
              type="button"
              onClick={handleReceive}
              disabled={receiving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#3E6E61] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {receiving ? (
                <RefreshCw
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <CheckCircle2 size={17} />
              )}

              {receiving
                ? "Memproses..."
                : "Terima Barang"}
            </button>
          )}

          {/* ===============================================
              REFRESH
              =============================================== */}

          <button
            type="button"
            onClick={loadData}
            disabled={
              loading || receiving
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-[#F5F8F6]"
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

      </div>

      {/* INFO */}

      <div className="mb-6 grid gap-4 md:grid-cols-4">

        {/* NOMOR */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-400">
            Nomor Penerimaan
          </p>

          <p className="mt-2 font-bold text-[#18352D]">
            {data.nomor}
          </p>
        </div>

        {/* TANGGAL */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-400">
            Tanggal
          </p>

          <p className="mt-2 font-semibold text-[#18352D]">
            {new Date(
              data.tanggal
            ).toLocaleDateString(
              "id-ID"
            )}
          </p>
        </div>

        {/* OUTLET */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-400">
            Outlet
          </p>

          <p className="mt-2 font-bold text-[#18352D]">
            {data.outlet?.name || "-"}
          </p>

          <p className="mt-1 text-xs text-gray-400">
            {data.outlet?.code || "-"}
          </p>
        </div>

        {/* SUPPLIER / SOURCE */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <p className="text-xs font-medium text-gray-400">
            {data.sumber === "PURCHASE"
              ? "Supplier"
              : "Sumber"}
          </p>

          {data.sumber ===
          "PURCHASE" ? (
            <>
              <p className="mt-2 font-bold text-[#18352D]">
                {data.supplier?.name ||
                  "-"}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                {data.supplier?.code ||
                  "-"}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 font-bold text-[#18352D]">
                Gudang Utama
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Kiriman Transfer
              </p>
            </>
          )}

        </div>

      </div>

      {/* STATUS */}

      <div className="mb-6 rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

        <div className="flex flex-wrap items-center justify-between gap-5">

          {/* SUMBER */}

          <div>
            <p className="text-xs font-medium text-gray-400">
              Sumber Barang
            </p>

            <div className="mt-2">
              {sourceBadge()}
            </div>
          </div>

          {/* STATUS BARANG MASUK */}

          <div>
            <p className="text-xs font-medium text-gray-400">
              Status Barang Masuk
            </p>

            <div className="mt-2">
              {statusBadge()}
            </div>
          </div>

          {/* PURCHASE ORDER */}

          {data.purchase && (
            <div>
              <p className="text-xs font-medium text-gray-400">
                Purchase Order
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#18352D]">
                  {data.purchase.number}
                </p>

                {purchaseStatusBadge()}
              </div>
            </div>
          )}

        </div>

        {/* ===============================================
            INFORMASI JIKA PO BELUM APPROVED
            =============================================== */}

        {data.sumber === "PURCHASE" &&
          purchaseStatus !== "APPROVED" &&
          !alreadyReceived && (
            <div className="mt-5 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">

              <div className="flex items-start gap-3">

                <div className="mt-0.5 shrink-0">
                  <PackageCheck
                    size={18}
                    className="text-yellow-600"
                  />
                </div>

                <div>

                  <p className="text-sm font-semibold text-yellow-800">
                    Barang belum dapat diterima
                  </p>

                  <p className="mt-1 text-xs leading-5 text-yellow-700">
                    Purchase Order masih berstatus{" "}
                    <strong>
                      {data.purchase?.status ||
                        "DRAFT"}
                    </strong>
                    . Barang hanya dapat diterima
                    setelah Purchase Order di-approve
                    oleh admin pusat.
                  </p>

                </div>

              </div>

            </div>
          )}

      </div>

      {/* ITEM TABLE */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        <div className="border-b border-[#E5ECE9] p-5">

          <h2 className="font-bold text-[#18352D]">
            Barang Diterima
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            {data.sumber === "TRANSFER"
              ? "Masukkan jumlah barang yang benar-benar diterima outlet"
              : "Daftar barang yang diterima outlet"}
          </p>

        </div>

        <div className="overflow-x-auto">

          <table className="min-w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Kode Barang
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Nama Barang
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Qty Kirim
                </th>

                {data.sumber ===
                  "TRANSFER" && (
                  <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                    Qty Diterima
                  </th>
                )}

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Harga
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Subtotal
                </th>

              </tr>

            </thead>

            <tbody>

              {data.items.length === 0 ? (
                <tr>

                  <td
                    colSpan={
                      data.sumber ===
                      "TRANSFER"
                        ? 7
                        : 6
                    }
                    className="px-5 py-12 text-center text-gray-400"
                  >
                    Tidak ada barang.
                  </td>

                </tr>
              ) : (
                data.items.map(
                  (item, index) => {

                    const qtyDiterima =
                      data.sumber ===
                      "TRANSFER"
                        ? Number(
                            receivedQty[
                              item.id
                            ] ?? 0
                          )
                        : item.qty;

                    const subtotal =
                      data.sumber ===
                      "TRANSFER"
                        ? qtyDiterima *
                          item.price
                        : item.subtotal;

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-[#EDF2EF] hover:bg-[#FAFCFB]"
                      >

                        <td className="px-5 py-4 text-gray-500">
                          {index + 1}
                        </td>

                        <td className="px-5 py-4 font-semibold text-[#18352D]">
                          {item.barang.code}
                        </td>

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {item.barang.name}
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            {item.barang.unit}
                          </div>

                        </td>

                        <td className="px-5 py-4 text-center font-semibold">
                          {item.qty}
                        </td>

                        {data.sumber ===
                          "TRANSFER" && (
                          <td className="px-5 py-4 text-center">

                            <input
                              type="number"
                              min={0}
                              max={item.qty}
                              value={
                                receivedQty[
                                  item.id
                                ] ?? ""
                              }
                              onChange={(e) => {
                                const value =
                                  e.target.value;

                                setReceivedQty(
                                  (prev) => ({
                                    ...prev,
                                    [item.id]:
                                      value ===
                                      ""
                                        ? 0
                                        : Number(
                                            value
                                          ),
                                  })
                                );
                              }}
                              disabled={
                                alreadyReceived ||
                                receiving
                              }
                              className="w-24 rounded-lg border border-[#CFE0D8] bg-white px-3 py-2 text-center font-semibold text-[#18352D] outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/20 disabled:bg-gray-100"
                            />

                            <div className="mt-1 text-[11px] text-gray-400">
                              Maks.{" "}
                              {item.qty}
                            </div>

                          </td>
                        )}

                        <td className="px-5 py-4 text-right">
                          Rp{" "}
                          {item.price.toLocaleString(
                            "id-ID"
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-[#18352D]">
                          Rp{" "}
                          {subtotal.toLocaleString(
                            "id-ID"
                          )}
                        </td>

                      </tr>
                    );
                  }
                )
              )}

            </tbody>

            <tfoot className="bg-[#F5F8F6]">

              <tr>

                <td
                  colSpan={
                    data.sumber ===
                    "TRANSFER"
                      ? 4
                      : 3
                  }
                  className="px-5 py-4 text-right font-bold text-[#35564C]"
                >
                  Total
                </td>

                <td className="px-5 py-4 text-center font-bold text-green-700">
                  {totalQty}
                </td>

                <td />

                <td className="px-5 py-4 text-right font-bold text-[#18352D]">
                  Rp{" "}
                  {totalValue.toLocaleString(
                    "id-ID"
                  )}
                </td>

              </tr>

            </tfoot>

          </table>

        </div>

      </div>

      {/* REMARKS */}

      {data.remarks && (
        <div className="mt-6 rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <p className="text-sm font-semibold text-[#35564C]">
            Catatan
          </p>

          <p className="mt-2 text-sm text-gray-600">
            {data.remarks}
          </p>

        </div>
      )}

    </div>
  );
}