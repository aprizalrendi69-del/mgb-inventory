"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  RefreshCw,
  ShoppingCart,
  Eye,
  ChevronDown,
  CreditCard,
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

type UserInfo = {
  id: number;
  fullname?: string;
  role: string;
  outletId?: number | null;
};

export default function OutletPurchasePage() {
  const router = useRouter();

  const [data, setData] =
    useState<OutletPurchase[]>([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  // =====================================================
  // FILTER
  // =====================================================

  const [selectedOutlet, setSelectedOutlet] =
    useState<string>("ALL");

  const [tanggalMulai, setTanggalMulai] =
    useState("");

  const [tanggalSelesai, setTanggalSelesai] =
    useState("");

  // =====================================================
  // USER
  // =====================================================

  const [user, setUser] =
    useState<UserInfo | null>(null);

  const [loadingUser, setLoadingUser] =
    useState(true);

  // =====================================================
  // LOAD USER
  // =====================================================

  async function loadUser() {
    try {
      setLoadingUser(true);

      const res = await fetch("/api/me", {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        setUser(null);
        return;
      }

      const currentUser =
        json?.user ??
        json?.data ??
        json;

      if (currentUser?.id) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error(
        "LOAD CURRENT USER ERROR:",
        error
      );

      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }

  // =====================================================
  // LOAD PURCHASE
  // =====================================================

  async function loadPurchase() {
    try {
      setLoading(true);

      const res = await fetch(
        "/api/outlet/purchase",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            "Gagal mengambil Purchase Outlet"
        );
      }

      setData(
        Array.isArray(json.data)
          ? json.data
          : []
      );
    } catch (error) {
      console.error(
        "LOAD OUTLET PURCHASE ERROR:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUser();
    loadPurchase();
  }, []);

  // =====================================================
  // ROLE
  // =====================================================

  const role =
    String(
      user?.role || ""
    ).toUpperCase();

  const isAdminPusat =
    role === "ADMIN";

  // =====================================================
  // DAFTAR OUTLET
  // =====================================================

  const outletOptions =
    useMemo(() => {
      const map =
        new Map<number, Outlet>();

      data.forEach((item) => {
        if (!item.outlet) {
          return;
        }

        if (
          !map.has(item.outlet.id)
        ) {
          map.set(
            item.outlet.id,
            item.outlet
          );
        }
      });

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          a.name.localeCompare(
            b.name
          )
      );
    }, [data]);

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
          const matchesSearch =
            !keyword ||
            item.number
              ?.toLowerCase()
              .includes(keyword) ||
            item.outlet?.code
              ?.toLowerCase()
              .includes(keyword) ||
            item.outlet?.name
              ?.toLowerCase()
              .includes(keyword) ||
            item.supplier?.code
              ?.toLowerCase()
              .includes(keyword) ||
            item.supplier?.name
              ?.toLowerCase()
              .includes(keyword) ||
            item.status
              ?.toLowerCase()
              .includes(keyword);

          if (!matchesSearch) {
            return false;
          }

          // ---------------------------------------------
          // FILTER OUTLET
          // ---------------------------------------------

          if (
            isAdminPusat &&
            selectedOutlet !== "ALL"
          ) {
            if (
              String(
                item.outletId
              ) !== selectedOutlet
            ) {
              return false;
            }
          }

          // ---------------------------------------------
          // FILTER TANGGAL
          // ---------------------------------------------

          const dateValue =
            item.purchaseDate ||
            item.createdAt;

          if (
            tanggalMulai ||
            tanggalSelesai
          ) {
            if (!dateValue) {
              return false;
            }

            const itemDate =
              new Date(dateValue);

            if (
              Number.isNaN(
                itemDate.getTime()
              )
            ) {
              return false;
            }

            const year =
              itemDate.getFullYear();

            const month =
              String(
                itemDate.getMonth() + 1
              ).padStart(2, "0");

            const day =
              String(
                itemDate.getDate()
              ).padStart(2, "0");

            const itemDateOnly =
              `${year}-${month}-${day}`;

            if (
              tanggalMulai &&
              itemDateOnly <
                tanggalMulai
            ) {
              return false;
            }

            if (
              tanggalSelesai &&
              itemDateOnly >
                tanggalSelesai
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
      selectedOutlet,
      tanggalMulai,
      tanggalSelesai,
      isAdminPusat,
    ]);

  // =====================================================
  // FORMAT
  // =====================================================

  function formatRupiah(
    value: number
  ) {
    return Number(
      value || 0
    ).toLocaleString(
      "id-ID"
    );
  }

  function formatDate(
    value?: string
  ) {
    if (!value) {
      return "-";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "-";
    }

    return date.toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  // =====================================================
  // STATUS
  // =====================================================

  function renderStatus(
    status: OutletPurchase["status"]
  ) {
    if (
      status === "APPROVED"
    ) {
      return (
        <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          APPROVED
        </span>
      );
    }

    if (
      status === "RECEIVED"
    ) {
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

  // =====================================================
  // RESET FILTER
  // =====================================================

  function resetFilter() {
    setSearch("");
    setSelectedOutlet("ALL");
    setTanggalMulai("");
    setTanggalSelesai("");
  }

  // =====================================================
  // PAYMENT
  // =====================================================

  function handlePayment(
    purchaseId: number
  ) {
    router.push(
      `/outlet/purchase/${purchaseId}/payment`
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

        <div className="flex flex-wrap gap-2">

          <button
            type="button"
            onClick={loadPurchase}
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

          <button
            type="button"
            onClick={() =>
              router.push(
                "/outlet/purchase/new"
              )
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#497F70] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3D6D60]"
          >
            <Plus size={17} />

            Purchase Baru
          </button>

        </div>

      </div>

      {/* =================================================
          TABLE CARD
      ================================================= */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        {/* =================================================
            FILTER
        ================================================= */}

        <div className="border-b border-[#E5ECE9] p-5">

          <div
            className={`grid gap-4 ${
              isAdminPusat
                ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
                : "grid-cols-1 md:grid-cols-2"
            }`}
          >

            {/* SEARCH */}

            <div
              className={
                isAdminPusat
                  ? "xl:col-span-1"
                  : "md:col-span-2"
              }
            >

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                Pencarian
              </label>

              <div className="relative">

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
                  placeholder="Cari nomor PO, supplier, status..."
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                />

              </div>

            </div>

            {/* OUTLET */}

            {isAdminPusat && (
              <div>

                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                  Outlet
                </label>

                <div className="relative">

                  <select
                    value={
                      selectedOutlet
                    }
                    onChange={(e) =>
                      setSelectedOutlet(
                        e.target.value
                      )
                    }
                    className="w-full appearance-none rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 pr-10 text-sm font-medium text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                  >

                    <option value="ALL">
                      Semua Outlet
                    </option>

                    {outletOptions.map(
                      (outlet) => (
                        <option
                          key={
                            outlet.id
                          }
                          value={String(
                            outlet.id
                          )}
                        >
                          {outlet.code} -{" "}
                          {outlet.name}
                        </option>
                      )
                    )}

                  </select>

                  <ChevronDown
                    size={17}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                </div>

              </div>
            )}

            {/* TANGGAL MULAI */}

            {isAdminPusat && (
              <div>

                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                  Tanggal Mulai
                </label>

                <input
                  type="date"
                  value={
                    tanggalMulai
                  }
                  onChange={(e) =>
                    setTanggalMulai(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                />

              </div>
            )}

            {/* TANGGAL SELESAI */}

            {isAdminPusat && (
              <div>

                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#58736A]">
                  Tanggal Selesai
                </label>

                <input
                  type="date"
                  value={
                    tanggalSelesai
                  }
                  onChange={(e) =>
                    setTanggalSelesai(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[#D5E5DC] bg-[#FAFCFB] px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10"
                />

              </div>
            )}

          </div>

          {isAdminPusat && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">

              <div className="text-xs text-gray-500">
                Menampilkan{" "}
                <span className="font-semibold text-[#497F70]">
                  {filteredData.length}
                </span>{" "}
                dari{" "}
                <span className="font-semibold text-gray-700">
                  {data.length}
                </span>{" "}
                Purchase Outlet
              </div>

              {(search ||
                selectedOutlet !==
                  "ALL" ||
                tanggalMulai ||
                tanggalSelesai) && (
                <button
                  type="button"
                  onClick={
                    resetFilter
                  }
                  className="rounded-lg border border-[#D5E5DC] bg-white px-3 py-2 text-xs font-semibold text-[#497F70] transition hover:bg-[#F5F8F6]"
                >
                  Reset Filter
                </button>
              )}

            </div>
          )}

        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="overflow-x-auto">

          <table className="min-w-[1180px] w-full text-sm">

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

              {loading ||
              loadingUser ? (

                <tr>

                  <td
                    colSpan={9}
                    className="px-5 py-14 text-center"
                  >

                    <div className="flex items-center justify-center gap-2 text-gray-500">

                      <RefreshCw
                        size={18}
                        className="animate-spin text-[#497F70]"
                      />

                      Memuat Purchase Outlet...

                    </div>

                  </td>

                </tr>

              ) : filteredData.length ===
                0 ? (

                <tr>

                  <td
                    colSpan={9}
                    className="px-5 py-14 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF3EF] text-[#497F70]">

                        <ShoppingCart
                          size={25}
                        />

                      </div>

                      <p className="font-semibold text-gray-700">
                        Belum ada Purchase Outlet
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
                  ) => (

                    <tr
                      key={
                        item.id
                      }
                      className="border-b border-[#EDF2EF] transition hover:bg-[#FAFCFB]"
                    >

                      {/* NO */}

                      <td className="px-5 py-4 text-gray-500">
                        {index + 1}
                      </td>

                      {/* NOMOR PO */}

                      <td className="px-5 py-4">

                        <div className="font-semibold text-[#18352D]">
                          {
                            item.number
                          }
                        </div>

                      </td>

                      {/* OUTLET */}

                      <td className="px-5 py-4">

                        <div className="font-medium text-gray-700">
                          {
                            item
                              .outlet
                              ?.name ||
                            "-"
                          }
                        </div>

                        <div className="mt-1 text-xs text-gray-400">
                          {
                            item
                              .outlet
                              ?.code ||
                            "-"
                          }
                        </div>

                      </td>

                      {/* SUPPLIER */}

                      <td className="px-5 py-4">

                        <div className="font-medium text-gray-700">
                          {
                            item
                              .supplier
                              ?.name ||
                            "-"
                          }
                        </div>

                        <div className="mt-1 text-xs text-gray-400">
                          {
                            item
                              .supplier
                              ?.code ||
                            "-"
                          }
                        </div>

                      </td>

                      {/* ITEM */}

                      <td className="px-5 py-4 text-center font-medium text-gray-700">
                        {
                          item
                            .items
                            ?.length ||
                          0
                        }
                      </td>

                      {/* TOTAL */}

                      <td className="px-5 py-4 text-right font-semibold text-[#18352D]">
                        Rp{" "}
                        {formatRupiah(
                          item.total
                        )}
                      </td>

                      {/* STATUS */}

                      <td className="px-5 py-4 text-center">
                        {renderStatus(
                          item.status
                        )}
                      </td>

                      {/* TANGGAL */}

                      <td className="px-5 py-4 text-center text-gray-500">
                        {formatDate(
                          item.purchaseDate ||
                            item.createdAt
                        )}
                      </td>

                      {/* =================================================
                          AKSI
                      ================================================= */}

                      <td className="px-5 py-4">

                        <div className="flex items-center justify-center gap-2">

                          {/* DETAIL */}

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
                            <Eye
                              size={17}
                            />
                          </button>

                          {/* PAYMENT */}

                          {item.status ===
                            "APPROVED" && (
                            <button
                              type="button"
                              onClick={() =>
                                handlePayment(
                                  item.id
                                )
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition hover:bg-blue-100"
                              title="Payment"
                            >
                              <CreditCard
                                size={17}
                              />
                            </button>
                          )}

                        </div>

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

            {/* =================================================
                FOOTER
            ================================================= */}

            {filteredData.length >
              0 && (
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