"use client";

import { useEffect, useState } from "react";
import {
  PackageCheck,
  RefreshCw,
  Search,
  Eye,
  Truck,
} from "lucide-react";
import { useRouter } from "next/navigation";

type BarangMasuk = {
  id: string;
  sourceId?: number;
  outletId?: number | null;

  sumber: "PURCHASE" | "TRANSFER";

  nomor: string;
  tanggal: string;
  status: string;

  totalItem: number;
  totalReceived: number;

  outlet?: {
    id: number;
    code: string;
    name: string;
  } | null;

  supplier?: {
    id: number;
    code: string;
    name: string;
  } | null;
};

export default function OutletBarangMasukPage() {
  const router = useRouter();

  const [data, setData] = useState<BarangMasuk[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // =====================================================
  // LOAD DATA
  // =====================================================

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch(
        "/api/outlet/barang-masuk",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const json = await res.json();

      console.log(
        "FRONTEND BARANG MASUK:",
        json
      );

      if (!res.ok || !json.success) {
        console.error(
          "LOAD BARANG MASUK:",
          json.message
        );

        setData([]);
        return;
      }

      const rows: BarangMasuk[] =
        Array.isArray(json.data)
          ? json.data
          : [];

      console.log(
        "ROWS BARANG MASUK:",
        rows
      );

      console.log(
        "TRANSFER BARANG MASUK:",
        rows.filter(
          (item) =>
            item.sumber === "TRANSFER"
        )
      );

      setData(rows);
    } catch (error) {
      console.error(
        "LOAD OUTLET BARANG MASUK ERROR:",
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

  // =====================================================
  // SEARCH
  // =====================================================

  const filteredData = data.filter(
    (item) => {
      const keyword =
        search
          .toLowerCase()
          .trim();

      if (!keyword) {
        return true;
      }

      return (
        item.nomor
          ?.toLowerCase()
          .includes(keyword) ||

        item.status
          ?.toLowerCase()
          .includes(keyword) ||

        item.sumber
          ?.toLowerCase()
          .includes(keyword) ||

        item.outlet?.code
          ?.toLowerCase()
          .includes(keyword) ||

        item.outlet?.name
          ?.toLowerCase()
          .includes(keyword) ||

        item.supplier?.name
          ?.toLowerCase()
          .includes(keyword)
      );
    }
  );

  // =====================================================
  // STATUS
  // =====================================================

  function statusBadge(
    status: string
  ) {
    const value =
      String(status || "")
        .toUpperCase();

    if (
      value === "RECEIVED" ||
      value === "SELESAI"
    ) {
      return (
        <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
          Diterima
        </span>
      );
    }

    if (value === "PARTIAL") {
      return (
        <span className="inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
          Sebagian
        </span>
      );
    }

    if (value === "SENT") {
      return (
        <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          Menunggu
        </span>
      );
    }

    if (value === "APPROVED") {
      return (
        <span className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
          Approved
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
  // SOURCE
  // =====================================================

  function sourceBadge(
    sumber: BarangMasuk["sumber"]
  ) {
    if (sumber === "TRANSFER") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          <Truck size={13} />
          Kiriman Gudang
        </span>
      );
    }

    return (
      <span className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
        Purchase Supplier
      </span>
    );
  }

  // =====================================================
  // DETAIL
  // =====================================================

  function bukaDetail(
    item: BarangMasuk
  ) {
    router.push(
      `/outlet/barang-masuk/${encodeURIComponent(
        item.id
      )}`
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

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <PackageCheck size={23} />
          </div>

          <div>

            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Barang Masuk Outlet
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Penerimaan barang dari supplier dan gudang utama
            </p>

          </div>

        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-50"
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

      {/* TABLE */}

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
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Cari nomor, sumber, outlet, atau status..."
              className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
            />

          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="min-w-[1000px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Nomor
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Sumber
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Tanggal
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Outlet
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Total Item
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Diterima
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

              {loading ? (

                <tr>

                  <td
                    colSpan={9}
                    className="px-5 py-16 text-center"
                  >

                    <div className="flex items-center justify-center gap-3 text-gray-500">

                      <RefreshCw
                        size={20}
                        className="animate-spin text-[#497F70]"
                      />

                      Memuat data...

                    </div>

                  </td>

                </tr>

              ) : filteredData.length === 0 ? (

                <tr>

                  <td
                    colSpan={9}
                    className="px-5 py-16 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF3EF] text-[#497F70]">

                        <PackageCheck size={25} />

                      </div>

                      <p className="font-semibold text-gray-700">
                        Belum ada barang masuk
                      </p>

                      <p className="mt-1 text-sm text-gray-400">
                        Barang dari supplier atau gudang akan muncul di sini.
                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                filteredData.map(
                  (item, index) => {

                    const isTransfer =
                      item.sumber ===
                      "TRANSFER";

                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-[#EDF2EF] transition ${
                          isTransfer
                            ? "bg-blue-50/30 hover:bg-blue-50"
                            : "hover:bg-[#FAFCFB]"
                        }`}
                      >

                        {/* NO */}

                        <td className="px-5 py-4 text-gray-500">
                          {index + 1}
                        </td>

                        {/* NOMOR */}

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {item.nomor}
                          </div>

                          {isTransfer && (
                            <div className="mt-1 text-xs font-medium text-blue-600">
                              Kiriman dari Gudang Pusat
                            </div>
                          )}

                        </td>

                        {/* SUMBER */}

                        <td className="px-5 py-4">
                          {sourceBadge(
                            item.sumber
                          )}
                        </td>

                        {/* TANGGAL */}

                        <td className="px-5 py-4 text-gray-600">

                          {item.tanggal
                            ? new Date(
                                item.tanggal
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

                        {/* OUTLET */}

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {item.outlet?.name ||
                              "-"}
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            {item.outlet?.code ||
                              "-"}
                          </div>

                        </td>

                        {/* TOTAL ITEM */}

                        <td className="px-5 py-4 text-center font-semibold text-[#18352D]">
                          {Number(
                            item.totalItem ?? 0
                          ).toLocaleString(
                            "id-ID"
                          )}
                        </td>

                        {/* RECEIVED */}

                        <td className="px-5 py-4 text-center font-semibold text-[#497F70]">
                          {Number(
                            item.totalReceived ?? 0
                          ).toLocaleString(
                            "id-ID"
                          )}
                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-4 text-center">
                          {statusBadge(
                            item.status
                          )}
                        </td>

                        {/* AKSI */}

                        <td className="px-5 py-4 text-center">

                          <button
                            type="button"
                            onClick={() =>
                              bukaDetail(
                                item
                              )
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70] transition hover:bg-[#DCEDE5]"
                            title="Lihat detail"
                          >

                            <Eye size={16} />

                          </button>

                        </td>

                      </tr>
                    );
                  }
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}