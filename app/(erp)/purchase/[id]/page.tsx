"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Edit,
  FileSpreadsheet,
  FileText,
  PackageCheck,
  Printer,
  Trash2,
  Truck,
} from "lucide-react";

import { exportPurchasePDF } from "@/lib/exportPurchasePdf";
import { exportPurchaseExcel } from "@/lib/exportPurchaseExcel";

export default function DetailPurchase() {
  const params = useParams();
  const router = useRouter();

  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  async function loadPurchase() {
    try {
      setLoading(true);

      const res = await fetch(`/api/purchase/${params.id}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setPurchase(json.data);
      } else {
        setPurchase(null);
      }
    } catch (error) {
      console.error("LOAD PURCHASE ERROR:", error);
      setPurchase(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (params.id) {
      loadPurchase();
    }
  }, [params.id]);

  async function deletePurchase() {
    if (!purchase) return;

    const confirmed = window.confirm(
      `Hapus Purchase Order ${purchase.number}?\n\nData PO beserta itemnya akan dihapus dan tidak dapat dikembalikan.`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);

      const res = await fetch(`/api/purchase/${purchase.id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (json.success) {
        alert("Purchase Order berhasil dihapus");
        router.push("/purchase");
        router.refresh();
      } else {
        alert(json.message || "Gagal menghapus Purchase Order");
      }
    } catch (error) {
      console.error("DELETE PURCHASE ERROR:", error);
      alert("Terjadi kesalahan saat menghapus Purchase Order");
    } finally {
      setDeleting(false);
    }
  }

  function formatRupiah(value: any) {
    return Number(value || 0).toLocaleString("id-ID");
  }

  function formatDate(value: any) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  function getStatusClass(status: string) {
    switch (status) {
      case "DRAFT":
        return "bg-amber-100 text-amber-700";

      case "APPROVED":
        return "bg-blue-100 text-blue-700";

      case "RECEIVED":
        return "bg-green-100 text-green-700";

      case "COMPLETED":
        return "bg-purple-100 text-purple-700";

      case "CANCELLED":
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  if (loading) {
    return (
      <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-[#DDE9E4] border-t-[#497F70]" />

            <p className="text-sm text-gray-500">
              Loading Purchase Order...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">
        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-10 text-center shadow-sm">
          <FileText
            size={42}
            className="mx-auto mb-4 text-gray-300"
          />

          <h2 className="text-lg font-bold text-gray-700">
            Purchase Order tidak ditemukan
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            Data Purchase Order yang kamu cari tidak tersedia.
          </p>

          <button
            onClick={() => router.push("/purchase")}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3D6D60]"
          >
            <ArrowLeft size={16} />
            Kembali ke Purchase
          </button>
        </div>
      </div>
    );
  }

  const totalItem = purchase.items?.length ?? 0;

  const totalQty =
    purchase.items?.reduce(
      (sum: number, item: any) =>
        sum + Number(item.qty || 0),
      0
    ) ?? 0;

  const totalNilai = Number(purchase.total ?? 0);

  const supplier = purchase.supplier?.name ?? "-";

  const isDraft = purchase.status === "DRAFT";
  const isApproved = purchase.status === "APPROVED";
  const isReceived = purchase.status === "RECEIVED";

  const statusOrder = [
    "DRAFT",
    "APPROVED",
    "RECEIVED",
    "COMPLETED",
  ];

  const currentStatusIndex =
    statusOrder.indexOf(purchase.status);

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <ShoppingCartIcon />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Detail Purchase Order
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              {purchase.number}
            </p>
          </div>

        </div>

        {/* ACTIONS */}

        <div className="flex flex-wrap gap-2">

          {/* EDIT */}
          {isDraft && (
            <button
              onClick={() =>
                router.push(`/purchase/${purchase.id}/edit`)
              }
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              <Edit size={16} />
              Edit
            </button>
          )}

          {/* DELETE */}
          {isDraft && (
            <button
              onClick={deletePurchase}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={16} />

              {deleting ? "Menghapus..." : "Hapus"}
            </button>
          )}

          {/* EXPORT PDF */}
          <button
            onClick={() => exportPurchasePDF(purchase)}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
          >
            <FileText size={16} />
            PDF
          </button>

          {/* EXPORT EXCEL */}
          <button
            onClick={() => exportPurchaseExcel(purchase)}
            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            <FileSpreadsheet size={16} />
            Excel
          </button>

          {/* PRINT */}
          <a
            href={`/purchase/print?id=${purchase.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Printer size={16} />
            Print
          </a>

          {/* RECEIVE */}
          {isApproved && (
            <a
              href={`/barang-masuk/create?purchaseId=${purchase.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#497F70] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3D6D60]"
            >
              <PackageCheck size={16} />
              Receive Barang
            </a>
          )}

          {/* BARANG MASUK */}
          {isReceived && (
            <a
              href="/barang-masuk"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <PackageCheck size={16} />
              Lihat Barang Masuk
            </a>
          )}

          {/* BACK */}
          <button
            onClick={() => router.push("/purchase")}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-[#F5F8F6]"
          >
            <ArrowLeft size={16} />
            Kembali
          </button>

        </div>
      </div>

      {/* =====================================================
          INFO WARNING DRAFT
      ===================================================== */}

      {isDraft && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">

          <Clock3
            size={20}
            className="mt-0.5 shrink-0 text-amber-600"
          />

          <div>
            <p className="font-semibold text-amber-800">
              Purchase Order masih Draft
            </p>

            <p className="mt-1 text-sm text-amber-700">
              PO masih dapat diedit atau dihapus.
              Setelah di-approve, data PO tidak dapat
              diubah atau dihapus.
            </p>
          </div>

        </div>
      )}

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* SUPPLIER */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div className="min-w-0">

              <p className="text-sm text-gray-500">
                Supplier
              </p>

              <p className="mt-2 truncate text-lg font-bold text-[#18352D]">
                {supplier}
              </p>

            </div>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Truck size={21} />
            </div>

          </div>

        </div>

        {/* ITEM */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-gray-500">
                Jumlah Item
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {totalItem}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileText size={21} />
            </div>

          </div>

        </div>

        {/* QTY */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-gray-500">
                Total Qty
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {formatRupiah(totalQty)}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
              <PackageCheck size={21} />
            </div>

          </div>

        </div>

        {/* NILAI */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div className="min-w-0">

              <p className="text-sm text-gray-500">
                Nilai Purchase
              </p>

              <p className="mt-1 truncate text-lg font-bold text-[#18352D]">
                Rp {formatRupiah(totalNilai)}
              </p>

            </div>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <FileText size={21} />
            </div>

          </div>

        </div>

      </div>

      {/* =====================================================
          STATUS TIMELINE
      ===================================================== */}

      <div className="mb-6 rounded-2xl border border-[#DDE9E4] bg-white p-6 shadow-sm">

        <div className="mb-6 flex items-center justify-between">

          <div>
            <h2 className="font-bold text-lg text-[#18352D]">
              Status Purchase Order
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Progress Purchase Order
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${getStatusClass(
              purchase.status
            )}`}
          >
            {purchase.status}
          </span>

        </div>

        <div className="overflow-x-auto">

          <div className="flex min-w-[600px] items-start">

            {[
              {
                name: "DRAFT",
                label: "Draft",
              },
              {
                name: "APPROVED",
                label: "Approved",
              },
              {
                name: "RECEIVED",
                label: "Received",
              },
              {
                name: "COMPLETED",
                label: "Completed",
              },
            ].map((step, index) => {

              const active =
                index <= currentStatusIndex;

              const isLast =
                index === 3;

              return (
                <div
                  key={step.name}
                  className="relative flex flex-1 flex-col items-center"
                >

                  <div className="flex w-full items-center">

                    <div
                      className={`h-1 flex-1 ${
                        index === 0
                          ? "bg-transparent"
                          : active
                          ? "bg-[#497F70]"
                          : "bg-gray-200"
                      }`}
                    />

                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        active
                          ? "bg-[#497F70] text-white"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {active ? (
                        <CheckCircle2 size={19} />
                      ) : (
                        index + 1
                      )}
                    </div>

                    <div
                      className={`h-1 flex-1 ${
                        isLast
                          ? "bg-transparent"
                          : active &&
                            index < currentStatusIndex
                          ? "bg-[#497F70]"
                          : "bg-gray-200"
                      }`}
                    />

                  </div>

                  <p
                    className={`mt-3 text-sm font-semibold ${
                      active
                        ? "text-[#18352D]"
                        : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </p>

                </div>
              );
            })}

          </div>

        </div>

      </div>

      {/* =====================================================
          INFORMATION
      ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* PURCHASE */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-6 shadow-sm">

          <h2 className="mb-5 text-lg font-bold text-[#18352D]">
            Informasi Purchase
          </h2>

          <div className="space-y-3 text-sm">

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                No PO
              </span>

              <span className="text-gray-700">
                : {purchase.number}
              </span>
            </div>

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                Tanggal
              </span>

              <span className="text-gray-700">
                : {formatDate(purchase.purchaseDate)}
              </span>
            </div>

            <div className="flex items-center">
              <span className="w-32 font-semibold text-gray-600">
                Status
              </span>

              <span>
                :{" "}
                <span
                  className={`ml-2 rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(
                    purchase.status
                  )}`}
                >
                  {purchase.status}
                </span>
              </span>
            </div>

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                Total
              </span>

              <span className="font-bold text-[#18352D]">
                : Rp {formatRupiah(purchase.total)}
              </span>
            </div>

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                Keterangan
              </span>

              <span className="text-gray-700">
                : {purchase.remarks || "-"}
              </span>
            </div>

          </div>

        </div>

        {/* SUPPLIER */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-6 shadow-sm">

          <h2 className="mb-5 text-lg font-bold text-[#18352D]">
            Informasi Supplier
          </h2>

          <div className="space-y-3 text-sm">

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                Nama
              </span>

              <span className="text-gray-700">
                : {purchase.supplier?.name || "-"}
              </span>
            </div>

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                PIC
              </span>

              <span className="text-gray-700">
                : {purchase.supplier?.contactPerson || "-"}
              </span>
            </div>

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                Telepon
              </span>

              <span className="text-gray-700">
                : {purchase.supplier?.phone || "-"}
              </span>
            </div>

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                Email
              </span>

              <span className="break-all text-gray-700">
                : {purchase.supplier?.email || "-"}
              </span>
            </div>

            <div className="flex">
              <span className="w-32 font-semibold text-gray-600">
                Alamat
              </span>

              <span className="text-gray-700">
                : {purchase.supplier?.address || "-"}
              </span>
            </div>

          </div>

        </div>

      </div>

      {/* =====================================================
          DETAIL BARANG
      ===================================================== */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        <div className="border-b border-[#E5ECE9] px-5 py-5">

          <h2 className="text-lg font-bold text-[#18352D]">
            Detail Barang Purchase
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Daftar barang yang terdapat dalam Purchase Order
          </p>

        </div>

        <div className="overflow-x-auto">

          <table className="min-w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Kode
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Nama Barang
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Satuan
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Qty
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Harga
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Subtotal
                </th>

              </tr>

            </thead>

            <tbody>

              {purchase.items?.map(
                (item: any, index: number) => {

                  const subtotal =
                    Number(item.qty || 0) *
                    Number(item.price || 0);

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
                    >

                      <td className="px-5 py-4 text-center text-gray-500">
                        {index + 1}
                      </td>

                      <td className="px-5 py-4 font-medium text-gray-700">
                        {item.barang?.code || "-"}
                      </td>

                      <td className="px-5 py-4 font-medium text-[#18352D]">
                        {item.barang?.name || "-"}
                      </td>

                      <td className="px-5 py-4 text-center text-gray-600">
                        {item.barang?.unit || "-"}
                      </td>

                      <td className="px-5 py-4 text-right font-semibold text-gray-700">
                        {formatRupiah(item.qty)}
                      </td>

                      <td className="px-5 py-4 text-right text-gray-600">
                        Rp {formatRupiah(item.price)}
                      </td>

                      <td className="px-5 py-4 text-right font-semibold text-[#18352D]">
                        Rp {formatRupiah(subtotal)}
                      </td>

                    </tr>
                  );
                }
              )}

              {(!purchase.items ||
                purchase.items.length === 0) && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-gray-400"
                  >
                    Tidak ada item Purchase.
                  </td>
                </tr>
              )}

            </tbody>

            <tfoot>

              <tr className="bg-[#F5F8F6]">

                <td
                  colSpan={4}
                  className="px-5 py-4 text-right font-bold text-[#35564C]"
                >
                  TOTAL
                </td>

                <td className="px-5 py-4 text-right font-bold text-[#18352D]">
                  {formatRupiah(totalQty)}
                </td>

                <td />

                <td className="px-5 py-4 text-right text-lg font-bold text-[#18352D]">
                  Rp {formatRupiah(totalNilai)}
                </td>

              </tr>

            </tfoot>

          </table>

        </div>

      </div>

      {/* =====================================================
          BOTTOM ACTION
      ===================================================== */}

      <div className="mt-6 flex flex-wrap justify-end gap-2">

        {isDraft && (
          <>
            <button
              onClick={() =>
                router.push(`/purchase/${purchase.id}/edit`)
              }
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-600"
            >
              <Edit size={17} />
              Edit Purchase
            </button>

            <button
              onClick={deletePurchase}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 size={17} />
              {deleting ? "Menghapus..." : "Hapus Purchase"}
            </button>
          </>
        )}

        <button
          onClick={() => router.push("/purchase")}
          className="inline-flex items-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-[#F5F8F6]"
        >
          <ArrowLeft size={17} />
          Kembali
        </button>

      </div>

    </div>
  );
}

/* =========================================================
   ICON HELPER
========================================================= */

function ShoppingCartIcon() {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="20" r="1" />
      <circle cx="20" cy="20" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}