"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ApprovePage() {
  const router = useRouter();
  const params = useParams();

  const [loading, setLoading] = useState(false);

  async function approve() {
    const id = params.id;

    if (!id) {
      alert("ID Purchase Order tidak ditemukan.");
      return;
    }

    const yakin = confirm(
      "Apakah Purchase Order ini akan disetujui?"
    );

    if (!yakin) return;

    try {
      setLoading(true);

      const res = await fetch(
        `/api/purchase/${id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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
        json.message ||
          "Purchase Order berhasil diapprove."
      );

      router.push("/purchase/approve");
      router.refresh();
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
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-[#18352D]">
            Approve Purchase Order
          </h1>

          <p className="mt-3 text-sm text-gray-500">
            Apakah Purchase Order ini akan disetujui?
          </p>

          <div className="mt-7 flex gap-3">
            <button
              type="button"
              onClick={approve}
              disabled={loading}
              className="rounded-xl bg-[#497F70] px-6 py-3 text-sm font-semibold text-white hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Memproses..."
                : "Approve"}
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              disabled={loading}
              className="rounded-xl bg-gray-500 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-600 disabled:opacity-50"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}