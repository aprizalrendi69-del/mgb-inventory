"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PackageCheck,
  RefreshCw,
  Search,
  Eye,
  Truck,
  CalendarDays,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

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

type BarangMasuk = {
  id: string;

  sourceId?: number | null;
  outletId?: number | null;

  sumber: "PURCHASE" | "TRANSFER";

  nomor: string;
  tanggal: string;
  status: string;

  totalItem: number;
  totalReceived: number;

  outlet?: Outlet | null;

  sourceOutlet?: Outlet | null;
  destinationOutlet?: Outlet | null;

  supplier?: Supplier | null;
};

export default function OutletBarangMasukPage() {
  const router = useRouter();

  const [data, setData] = useState<BarangMasuk[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // =====================================================
  // USER LOGIN
  // =====================================================

  const [role, setRole] = useState("");
  const [userOutletId, setUserOutletId] =
    useState<number | null>(null);

  const isAdminPusat =
    role === "ADMIN" ||
    role === "MANAGER";

  const isOutletAdmin =
    role === "OUTLET_ADMIN";

  // =====================================================
  // FILTER ADMIN PUSAT
  // =====================================================

  const [selectedOutlet, setSelectedOutlet] =
    useState("ALL");

  const [dateFrom, setDateFrom] =
    useState("");

  const [dateTo, setDateTo] =
    useState("");

  // =====================================================
  // LOAD DATA
  // =====================================================

  async function loadData() {
    try {
      setLoading(true);

      // =================================================
      // CURRENT USER
      // =================================================

      const meRes = await fetch("/api/me", {
        cache: "no-store",
      });

      const meJson = await meRes.json();

      if (!meRes.ok || !meJson.success) {
        console.error(
          "LOAD USER:",
          meJson.message
        );

        setData([]);
        return;
      }

      const loginUser =
        meJson.user;

      const loginRole =
        String(
          loginUser?.role || ""
        ).toUpperCase();

      const loginOutletId =
        loginUser?.outletId
          ? Number(loginUser.outletId)
          : null;

      setRole(loginRole);
      setUserOutletId(
        Number.isInteger(loginOutletId)
          ? loginOutletId
          : null
      );

      // =================================================
      // BARANG MASUK OUTLET
      // =================================================

      const res = await fetch(
        "/api/outlet/barang-masuk",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const json =
        await res.json();

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
  // OUTLET OPTIONS
  //
  // Untuk ADMIN / MANAGER.
  // Ambil outlet tujuan dari data.
  // =====================================================

  const outletOptions =
    useMemo(() => {
      const map =
        new Map<number, Outlet>();

      data.forEach((item) => {
        const outlet =
          item.destinationOutlet ||
          item.outlet;

        if (
          outlet &&
          outlet.id
        ) {
          map.set(
            outlet.id,
            outlet
          );
        }
      });

      return Array.from(
        map.values()
      ).sort((a, b) =>
        `${a.code} ${a.name}`.localeCompare(
          `${b.code} ${b.name}`,
          "id"
        )
      );
    }, [data]);

  // =====================================================
  // GET DATE ONLY
  // =====================================================

  function getDateOnly(
    value: string
  ) {
    if (!value) {
      return "";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        date.getDate()
      ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  // =====================================================
  // FILTER DATA
  // =====================================================

  const filteredData =
    useMemo(() => {
      const keyword =
        search
          .toLowerCase()
          .trim();

      return data.filter(
        (item) => {
          const destinationOutlet =
            item.destinationOutlet ||
            item.outlet;

          const sourceOutlet =
            item.sourceOutlet;

          // =============================================
          // SECURITY CLIENT
          //
          // Outlet admin hanya outlet miliknya.
          // API tetap menjadi security utama.
          // =============================================

          if (
            isOutletAdmin &&
            userOutletId !== null
          ) {
            if (
              Number(
                destinationOutlet?.id
              ) !==
              Number(
                userOutletId
              )
            ) {
              return false;
            }
          }

          // =============================================
          // SEARCH
          // =============================================

          if (keyword) {
            const matchesSearch =
              item.nomor
                ?.toLowerCase()
                .includes(keyword) ||

              item.status
                ?.toLowerCase()
                .includes(keyword) ||

              item.sumber
                ?.toLowerCase()
                .includes(keyword) ||

              destinationOutlet?.code
                ?.toLowerCase()
                .includes(keyword) ||

              destinationOutlet?.name
                ?.toLowerCase()
                .includes(keyword) ||

              sourceOutlet?.code
                ?.toLowerCase()
                .includes(keyword) ||

              sourceOutlet?.name
                ?.toLowerCase()
                .includes(keyword) ||

              item.supplier?.code
                ?.toLowerCase()
                .includes(keyword) ||

              item.supplier?.name
                ?.toLowerCase()
                .includes(keyword);

            if (!matchesSearch) {
              return false;
            }
          }

          // =============================================
          // FILTER OUTLET
          //
          // ADMIN / MANAGER
          // =============================================

          if (
            isAdminPusat &&
            selectedOutlet !== "ALL"
          ) {
            if (
              Number(
                destinationOutlet?.id
              ) !==
              Number(
                selectedOutlet
              )
            ) {
              return false;
            }
          }

          // =============================================
          // FILTER TANGGAL DARI
          // =============================================

          if (
            isAdminPusat &&
            dateFrom
          ) {
            const itemDate =
              getDateOnly(
                item.tanggal
              );

            if (
              itemDate &&
              itemDate < dateFrom
            ) {
              return false;
            }
          }

          // =============================================
          // FILTER TANGGAL SAMPAI
          // =============================================

          if (
            isAdminPusat &&
            dateTo
          ) {
            const itemDate =
              getDateOnly(
                item.tanggal
              );

            if (
              itemDate &&
              itemDate > dateTo
            ) {
              return false;
            }
          }

          return true;
        }
      );
    }, [
      data,
      search,
      isAdminPusat,
      isOutletAdmin,
      userOutletId,
      selectedOutlet,
      dateFrom,
      dateTo,
    ]);

  // =====================================================
  // RESET FILTER
  // =====================================================

  function resetFilter() {
    setSelectedOutlet("ALL");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  }

  // =====================================================
  // STATUS BADGE
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

    if (
      value === "PARTIAL"
    ) {
      return (
        <span className="inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
          Sebagian
        </span>
      );
    }

    if (
      value === "SENT"
    ) {
      return (
        <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          Menunggu
        </span>
      );
    }

    if (
      value === "APPROVED"
    ) {
      return (
        <span className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
          Approved
        </span>
      );
    }

    if (
      value === "DRAFT"
    ) {
      return (
        <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
          Draft
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
  // SOURCE BADGE
  // =====================================================

  function sourceBadge(
    item: BarangMasuk
  ) {
    if (
      item.sumber ===
      "TRANSFER"
    ) {
      return (
        <div className="flex flex-col items-start gap-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            <Truck size={13} />
            Kiriman Gudang
          </span>

          {item.sourceOutlet && (
            <span className="text-xs text-gray-400">
              Dari:{" "}
              {item.sourceOutlet.code}{" "}
              -{" "}
              {item.sourceOutlet.name}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-start gap-1">
        <span className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
          Purchase Supplier
        </span>

        {item.supplier && (
          <span className="text-xs text-gray-400">
            {item.supplier.code} -{" "}
            {item.supplier.name}
          </span>
        )}
      </div>
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

      {/* =================================================
          HEADER
      ================================================= */}

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

      {/* =================================================
          FILTER ADMIN / MANAGER
      ================================================= */}

      {isAdminPusat && (
        <div className="mb-6 rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="mb-4 flex flex-col gap-1">

            <h2 className="font-semibold text-[#18352D]">
              Filter Barang Masuk
            </h2>

            <p className="text-xs text-gray-500">
              Filter berdasarkan outlet dan periode tanggal
            </p>

          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            {/* OUTLET */}

            <div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Outlet
              </label>

              <select
                value={
                  selectedOutlet
                }
                onChange={(e) =>
                  setSelectedOutlet(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm font-medium text-[#35564C] outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
              >

                <option value="ALL">
                  Semua Outlet
                </option>

                {outletOptions.map(
                  (item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.code} -{" "}
                      {item.name}
                    </option>
                  )
                )}

              </select>

            </div>

            {/* TANGGAL DARI */}

            <div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Tanggal Dari
              </label>

              <div className="relative">

                <CalendarDays
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="date"
                  value={dateFrom}
                  max={
                    dateTo ||
                    undefined
                  }
                  onChange={(e) =>
                    setDateFrom(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-4 text-sm font-medium text-[#35564C] outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                />

              </div>

            </div>

            {/* TANGGAL SAMPAI */}

            <div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Tanggal Sampai
              </label>

              <div className="relative">

                <CalendarDays
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="date"
                  value={dateTo}
                  min={
                    dateFrom ||
                    undefined
                  }
                  onChange={(e) =>
                    setDateTo(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-4 text-sm font-medium text-[#35564C] outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                />

              </div>

            </div>

          </div>

          {/* RESET */}

          {(selectedOutlet !==
            "ALL" ||
            dateFrom ||
            dateTo) && (
            <div className="mt-4 flex justify-end">

              <button
                type="button"
                onClick={
                  resetFilter
                }
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 transition hover:bg-[#F5F8F6] hover:text-[#35564C]"
              >

                <X size={14} />

                Reset Filter

              </button>

            </div>
          )}

        </div>
      )}

      {/* =================================================
          TABLE
      ================================================= */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        {/* SEARCH */}

        <div className="flex flex-col gap-3 border-b border-[#E5ECE9] p-5 md:flex-row md:items-center md:justify-between">

          <div className="relative max-w-md">

            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Cari nomor, sumber, outlet, supplier, atau status..."
              className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
            />

          </div>

          <div className="text-xs text-gray-400">
            Menampilkan{" "}
            <span className="font-semibold text-[#35564C]">
              {filteredData.length}
            </span>{" "}
            dari{" "}
            <span className="font-semibold text-[#35564C]">
              {data.length}
            </span>{" "}
            transaksi
          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="min-w-[1100px] w-full text-sm">

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
                  Outlet Tujuan
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

              ) : filteredData.length ===
                0 ? (

                <tr>

                  <td
                    colSpan={9}
                    className="px-5 py-16 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF3EF] text-[#497F70]">

                        <PackageCheck
                          size={25}
                        />

                      </div>

                      <p className="font-semibold text-gray-700">
                        Belum ada barang masuk
                      </p>

                      <p className="mt-1 text-sm text-gray-400">
                        Tidak ada data yang sesuai dengan filter.
                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                filteredData.map(
                  (
                    item,
                    index
                  ) => {

                    const isTransfer =
                      item.sumber ===
                      "TRANSFER";

                    const destinationOutlet =
                      item.destinationOutlet ||
                      item.outlet;

                    return (
                      <tr
                        key={
                          item.id
                        }
                        className={`border-b border-[#EDF2EF] transition ${
                          isTransfer
                            ? "bg-blue-50/30 hover:bg-blue-50"
                            : "hover:bg-[#FAFCFB]"
                        }`}
                      >

                        {/* NO */}

                        <td className="px-5 py-4 text-gray-500">
                          {index +
                            1}
                        </td>

                        {/* NOMOR */}

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {
                              item.nomor
                            }
                          </div>

                          {isTransfer &&
                            item.sourceOutlet && (
                              <div className="mt-1 text-xs font-medium text-blue-600">
                                Dari{" "}
                                {
                                  item
                                    .sourceOutlet
                                    .name
                                }
                              </div>
                            )}

                        </td>

                        {/* SUMBER */}

                        <td className="px-5 py-4">
                          {sourceBadge(
                            item
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
                                  month:
                                    "2-digit",
                                  year:
                                    "numeric",
                                }
                              )
                            : "-"}

                        </td>

                        {/* OUTLET */}

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {
                              destinationOutlet
                                ?.name ||
                              "-"
                            }
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            {
                              destinationOutlet
                                ?.code ||
                              "-"
                            }
                          </div>

                        </td>

                        {/* TOTAL ITEM */}

                        <td className="px-5 py-4 text-center font-semibold text-[#18352D]">
                          {Number(
                            item.totalItem ??
                              0
                          ).toLocaleString(
                            "id-ID"
                          )}
                        </td>

                        {/* RECEIVED */}

                        <td className="px-5 py-4 text-center font-semibold text-[#497F70]">
                          {Number(
                            item.totalReceived ??
                              0
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

                            <Eye
                              size={16}
                            />

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