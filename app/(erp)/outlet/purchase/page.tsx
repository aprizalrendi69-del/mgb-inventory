"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  RefreshCw,
  ShoppingCart,
  Eye,
} from "lucide-react";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type Supplier = {
  id: number;
  code: string;
  name: string;
};

type Barang = {
  id: number;
  code: string;
  name: string;
  unit: string;
};

type PurchaseItem = {
  id: number;
  barangId: number;
  qty: number;
  receivedQty?: number;
  price: number;
  subtotal: number;
  barang: Barang;
};

type OutletPurchase = {
  id: number;
  number: string;
  outletId: number;
  supplierId: number;
  total: number;
  status: "DRAFT" | "APPROVED" | "RECEIVED";
  purchaseDate?: string;
  createdAt?: string;
  remarks: string | null;
  outlet: Outlet;
  supplier: Supplier;
  items: PurchaseItem[];
};

export default function OutletPurchasePage() {
  const router = useRouter();

  const [data, setData] = useState<OutletPurchase[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadPurchase() {
    try {
      setLoading(true);

      const res = await fetch("/api/outlet/purchase", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Gagal mengambil Purchase Outlet"
        );
      }

      setData(json.data || []);
    } catch (error) {
      console.error("LOAD OUTLET PURCHASE ERROR:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPurchase();
  }, []);

  const filteredData = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) return data;

    return data.filter((item) => {
      return (
        item.number.toLowerCase().includes(keyword) ||
        item.outlet?.code?.toLowerCase().includes(keyword) ||
        item.outlet?.name?.toLowerCase().includes(keyword) ||
        item.supplier?.code?.toLowerCase().includes(keyword) ||
        item.supplier?.name?.toLowerCase().includes(keyword) ||
        item.status.toLowerCase().includes(keyword)
      );
    });
  }, [data, search]);

  function formatRupiah(value: number) {
    return Number(value || 0).toLocaleString("id-ID");
  }

  function formatDate(value?: string) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function renderStatus(status: OutletPurchase["status"]) {
    if (status === "APPROVED") {
      return (
        <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          APPROVED
        </span>
      );
    }

    if (status === "RECEIVED") {
      return (
        <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
          RECEIVED
        </span>
      );
    }

    return (
      <span className="inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
        DRAFT
      </span>
    );
  }

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">
      {/* HEADER */}
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <ShoppingCart size={23} />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Purchase Outlet
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Daftar Purchase Order untuk outlet
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadPurchase}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-[#F5F8F6] disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => router.push("/outlet/purchase/new")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3D6D60]"
          >
            <Plus size={17} />
            Purchase Baru
          </button>
        </div>
      </div>

      {/* TABLE CARD */}
      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">
        {/* SEARCH */}
        <div className="border-b border-[#E5ECE9] p-5">
          <div className="relative max-w-md">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor PO, outlet, supplier, status..."
              className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
            />
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F5F8F6]">
              <tr className="border-b border-[#E5ECE9]">
                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Nomor PO
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Outlet
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Supplier
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
                  Tanggal
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-14 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <RefreshCw
                        size={18}
                        className="animate-spin text-[#497F70]"
                      />
                      Memuat Purchase Outlet...
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-14 text-center">
                    <div className="flex flex-col items-center">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF3EF] text-[#497F70]">
                        <ShoppingCart size={25} />
                      </div>

                      <p className="font-semibold text-gray-700">
                        Belum ada Purchase Outlet
                      </p>

                      <p className="mt-1 text-sm text-gray-400">
                        Buat Purchase Outlet baru untuk mulai.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr
                    key={item.id}
                    className="border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
                  >
                    <td className="px-5 py-4 text-gray-500">
                      {index + 1}
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-semibold text-[#18352D]">
                        {item.number}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-700">
                        {item.outlet?.name || "-"}
                      </div>

                      <div className="mt-1 text-xs text-gray-400">
                        {item.outlet?.code || "-"}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-700">
                        {item.supplier?.name || "-"}
                      </div>

                      <div className="mt-1 text-xs text-gray-400">
                        {item.supplier?.code || "-"}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-center font-medium text-gray-700">
                      {item.items?.length || 0}
                    </td>

                    <td className="px-5 py-4 text-right font-semibold text-[#18352D]">
                      Rp {formatRupiah(item.total)}
                    </td>

                    <td className="px-5 py-4 text-center">
                      {renderStatus(item.status)}
                    </td>

                    <td className="px-5 py-4 text-center text-gray-500">
                      {formatDate(
                        item.purchaseDate || item.createdAt
                      )}
                    </td>

                    <td className="px-5 py-4 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/outlet/purchase/${item.id}`
                          )
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70] transition hover:bg-[#DDEDE6]"
                        title="Lihat Detail"
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {filteredData.length > 0 && (
              <tfoot>
                <tr className="bg-[#F5F8F6]">
                  <td
                    colSpan={5}
                    className="px-5 py-4 text-right font-bold text-[#18352D]"
                  >
                    TOTAL PO
                  </td>

                  <td className="px-5 py-4 text-right font-bold text-[#18352D]">
                    {filteredData.length}
                  </td>

                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}