"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Search,
  RefreshCw,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  Package,
  Wallet,
  Store,
  FileText,
} from "lucide-react";

type Role = "ADMIN" | "OUTLET_ADMIN";

type User = {
  id: number;
  username: string;
  fullname: string;
  role: Role;
  outletId: number | null;
  outlet?: Outlet | null;
};

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type Barang = {
  id: number;
  code: string;
  name: string;
  unit: string;
  purchasePrice?: number;
  sellingPrice?: number;
};

type OutletStock = {
  id: number;
  outletId: number;
  barangId: number;
  stock: number;
  minimumStock: number;
  averageCost: number;
  updatedAt: string;
  outlet: Outlet;
  barang: Barang;
};

export default function OutletStockReportPage() {
  const [user, setUser] = useState<User | null>(null);

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [data, setData] = useState<OutletStock[]>([]);

  const [selectedOutlet, setSelectedOutlet] =
    useState("");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingOutlet, setLoadingOutlet] =
    useState(true);

  // =====================================================
  // LOAD USER
  // =====================================================

  async function loadUser() {
    const res = await fetch("/api/me", {
      cache: "no-store",
    });

    const json = await res.json();

    if (!res.ok || !json.success || !json.user) {
      throw new Error(
        json.message || "Gagal mengambil user login"
      );
    }

    const loginUser: User = json.user;

    setUser(loginUser);

    return loginUser;
  }

  // =====================================================
  // LOAD OUTLET
  // =====================================================

  async function loadOutlets(loginUser?: User) {
    try {
      setLoadingOutlet(true);

      const currentUser =
        loginUser || user;

      if (
        currentUser?.role ===
        "OUTLET_ADMIN"
      ) {
        if (
          currentUser.outlet
        ) {
          setOutlets([
            currentUser.outlet,
          ]);

          setSelectedOutlet(
            String(
              currentUser.outlet.id
            )
          );
        }

        return;
      }

      const res = await fetch(
        "/api/outlet",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      const list: Outlet[] =
        Array.isArray(json)
          ? json
          : Array.isArray(json.data)
          ? json.data
          : [];

      setOutlets(list);
    } catch (error) {
      console.error(
        "LOAD OUTLET REPORT ERROR:",
        error
      );

      setOutlets([]);
    } finally {
      setLoadingOutlet(false);
    }
  }

  // =====================================================
  // LOAD STOCK
  // =====================================================

  async function loadData(
    outletFilter?: string
  ) {
    try {
      setLoading(true);

      const currentUser =
        user || (await loadUser());

      let url =
        "/api/outlet/stock-awal";

      if (
        currentUser.role ===
        "OUTLET_ADMIN"
      ) {
        if (!currentUser.outletId) {
          setData([]);
          return;
        }

        url += `?outletId=${currentUser.outletId}`;
      } else if (
        outletFilter
      ) {
        url += `?outletId=${outletFilter}`;
      }

      const res = await fetch(
        url,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil stock outlet"
        );
      }

      const stocks: OutletStock[] =
        Array.isArray(json.data)
          ? json.data
          : [];

      // =================================================
      // SECURITY FILTER CLIENT
      // OUTLET ADMIN HANYA BOLEH MELIHAT OUTLET SENDIRI
      // =================================================

      const filtered =
        currentUser.role ===
        "OUTLET_ADMIN"
          ? stocks.filter(
              (item) =>
                Number(
                  item.outletId
                ) ===
                Number(
                  currentUser.outletId
                )
            )
          : outletFilter
          ? stocks.filter(
              (item) =>
                Number(
                  item.outletId
                ) ===
                Number(outletFilter)
            )
          : stocks;

      setData(filtered);
    } catch (error) {
      console.error(
        "LOAD OUTLET STOCK REPORT ERROR:",
        error
      );

      setData([]);
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // INITIAL
  // =====================================================

  useEffect(() => {
    async function init() {
      try {
        const loginUser =
          await loadUser();

        await loadOutlets(
          loginUser
        );

        if (
          loginUser.role ===
          "OUTLET_ADMIN"
        ) {
          await loadData(
            String(
              loginUser.outletId
            )
          );
        } else {
          await loadData("");
        }
      } catch (error) {
        console.error(
          "INIT OUTLET REPORT ERROR:",
          error
        );

        setData([]);
        setLoading(false);
      }
    }

    init();
  }, []);

  // =====================================================
  // CHANGE OUTLET
  // =====================================================

  async function handleOutletChange(
    value: string
  ) {
    setSelectedOutlet(value);

    await loadData(value);
  }

  // =====================================================
  // SEARCH
  // =====================================================

  const filteredData = useMemo(() => {
    const keyword =
      search
        .toLowerCase()
        .trim();

    if (!keyword) {
      return data;
    }

    return data.filter(
      (item) => {
        const text = [
          item.barang?.code,
          item.barang?.name,
          item.barang?.unit,
          item.barang?.barcode,
          item.outlet?.code,
          item.outlet?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(
          keyword
        );
      }
    );
  }, [data, search]);

  // =====================================================
  // FORMAT
  // =====================================================

  function formatNumber(
    value: number
  ) {
    return Number(
      value || 0
    ).toLocaleString(
      "id-ID"
    );
  }

  function formatRupiah(
    value: number
  ) {
    return `Rp ${formatNumber(
      value
    )}`;
  }

  // =====================================================
  // STATUS
  // =====================================================

  function getStockStatus(
    item: OutletStock
  ) {
    const stock =
      Number(
        item.stock || 0
      );

    const minimum =
      Number(
        item.minimumStock || 0
      );

    if (stock <= 0) {
      return "HABIS";
    }

    if (stock <= minimum) {
      return "MINIMUM";
    }

    return "AMAN";
  }

  function getStatusClass(
    item: OutletStock
  ) {
    const status =
      getStockStatus(item);

    if (status === "HABIS") {
      return "bg-[#FDECEC] text-[#C84B4B]";
    }

    if (
      status === "MINIMUM"
    ) {
      return "bg-[#FFF4DD] text-[#9A6A18]";
    }

    return "bg-[#E8F4EC] text-[#2F7A4F]";
  }

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalBarang =
    filteredData.length;

  const totalQty =
    filteredData.reduce(
      (sum, item) =>
        sum +
        Number(
          item.stock || 0
        ),
      0
    );

  const totalNilai =
    filteredData.reduce(
      (sum, item) =>
        sum +
        Number(
          item.stock || 0
        ) *
          Number(
            item.averageCost ||
              0
          ),
      0
    );

  const totalHabis =
    filteredData.filter(
      (item) =>
        getStockStatus(
          item
        ) === "HABIS"
    ).length;

  const totalMinimum =
    filteredData.filter(
      (item) =>
        getStockStatus(
          item
        ) === "MINIMUM"
    ).length;

  // =====================================================
  // NAMA OUTLET TERPILIH
  // =====================================================

  const selectedOutletData =
    outlets.find(
      (item) =>
        String(item.id) ===
        selectedOutlet
    );

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#497F70] text-white shadow-sm">
            <Boxes size={23} />
          </div>

          <div>

            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Laporan Stock Outlet
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Laporan persediaan barang
              berdasarkan stock outlet
            </p>

          </div>

        </div>

        <button
          type="button"
          onClick={() =>
            loadData(
              selectedOutlet
            )
          }
          disabled={loading}
          className="
            inline-flex
            items-center
            justify-center
            gap-2
            rounded-xl
            border
            border-[#DDE9E4]
            bg-white
            px-4
            py-2.5
            text-sm
            font-semibold
            text-[#35564C]
            shadow-sm
            hover:bg-[#F5F8F6]
            disabled:opacity-50
          "
        >
          <RefreshCw
            size={16}
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
          FILTER
      ================================================= */}

      <div className="mb-6 rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          {/* OUTLET */}

          <div>

            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#35564C]">
              <Store size={16} />
              Outlet
            </label>

            <select
              value={
                user?.role ===
                "OUTLET_ADMIN"
                  ? String(
                      user.outletId ??
                        ""
                    )
                  : selectedOutlet
              }
              disabled={
                user?.role ===
                  "OUTLET_ADMIN" ||
                loadingOutlet
              }
              onChange={(e) =>
                handleOutletChange(
                  e.target.value
                )
              }
              className="
                w-full
                rounded-xl
                border
                border-[#D5E5DC]
                bg-[#FAFCFB]
                px-4
                py-3
                text-sm
                font-medium
                text-[#35564C]
                outline-none
                focus:border-[#497F70]
                focus:bg-white
                focus:ring-2
                focus:ring-[#497F70]/10
                disabled:cursor-not-allowed
                disabled:bg-gray-100
              "
            >

              {user?.role ===
                "ADMIN" && (
                <option value="">
                  -- Semua Outlet --
                </option>
              )}

              {outlets.map(
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

          {/* SEARCH */}

          <div>

            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#35564C]">
              <Search size={16} />
              Cari Barang
            </label>

            <div className="relative">

              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Cari kode, barcode, nama barang..."
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  py-3
                  pl-9
                  pr-4
                  text-sm
                  outline-none
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />

            </div>

          </div>

        </div>

        {/* INFO FILTER */}

        <div className="mt-4 flex flex-wrap items-center gap-2">

          <span className="rounded-full bg-[#EAF3EF] px-3 py-1.5 text-xs font-semibold text-[#497F70]">
            {user?.role ===
            "ADMIN"
              ? selectedOutletData
                ? `Outlet: ${selectedOutletData.code} - ${selectedOutletData.name}`
                : "Semua Outlet"
              : user?.outlet
              ? `Outlet: ${user.outlet.code} - ${user.outlet.name}`
              : "Outlet Login"}
          </span>

          <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500">
            Sumber: Stock Awal Outlet + Mutasi Outlet
          </span>

        </div>

      </div>

      {/* =================================================
          SUMMARY
      ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

        {/* TOTAL BARANG */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Total Barang
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalBarang
                )}
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Package size={19} />
            </div>

          </div>

        </div>

        {/* TOTAL QTY */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Total Stock
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalQty
                )}
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Boxes size={19} />
            </div>

          </div>

        </div>

        {/* NILAI */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Nilai Persediaan
              </p>

              <p className="mt-2 text-lg font-bold text-[#18352D]">
                {formatRupiah(
                  totalNilai
                )}
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Wallet size={19} />
            </div>

          </div>

        </div>

        {/* PERHATIAN */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Perlu Perhatian
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalHabis +
                    totalMinimum
                )}
              </p>

              <p className="mt-1 text-[11px] text-gray-400">
                Habis:{" "}
                {totalHabis}{" "}
                · Minimum:{" "}
                {totalMinimum}
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF4DD] text-[#9A6A18]">
              <AlertTriangle
                size={19}
              />
            </div>

          </div>

        </div>

      </div>

      {/* =================================================
          TABLE
      ================================================= */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        <div className="flex flex-col gap-3 border-b border-[#E5ECE9] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <FileText size={19} />
            </div>

            <div>

              <h2 className="font-semibold text-[#18352D]">
                Stock Barang Outlet
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                {user?.role ===
                "ADMIN"
                  ? "Data stock seluruh outlet sesuai filter"
                  : "Data stock outlet yang sedang login"}
              </p>

            </div>

          </div>

          <div className="text-xs text-gray-400">
            {formatNumber(
              filteredData.length
            )} barang
          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="min-w-[1250px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                {user?.role ===
                  "ADMIN" && (
                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Outlet
                  </th>
                )}

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Kode
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Barang
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Satuan
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Stock
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Minimum
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Harga Modal
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Nilai Stock
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td
                    colSpan={
                      user?.role ===
                      "ADMIN"
                        ? 9
                        : 8
                    }
                    className="px-5 py-12 text-center"
                  >

                    <RefreshCw
                      size={20}
                      className="mx-auto mb-2 animate-spin text-[#497F70]"
                    />

                    <p className="text-sm text-gray-500">
                      Memuat laporan
                      stock outlet...
                    </p>

                  </td>

                </tr>

              ) : filteredData.length ===
                0 ? (

                <tr>

                  <td
                    colSpan={
                      user?.role ===
                      "ADMIN"
                        ? 9
                        : 8
                    }
                    className="px-5 py-14 text-center"
                  >

                    <Package
                      size={40}
                      className="mx-auto mb-3 text-gray-300"
                    />

                    <p className="text-sm font-medium text-gray-500">
                      Belum ada stock
                      outlet
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      Pastikan Stock Awal
                      Outlet sudah
                      dimasukkan.
                    </p>

                  </td>

                </tr>

              ) : (

                filteredData.map(
                  (item) => {

                    const stock =
                      Number(
                        item.stock ||
                          0
                      );

                    const minimum =
                      Number(
                        item.minimumStock ||
                          0
                      );

                    const averageCost =
                      Number(
                        item.averageCost ||
                          0
                      );

                    const nilaiStock =
                      stock *
                      averageCost;

                    const status =
                      getStockStatus(
                        item
                      );

                    return (
                      <tr
                        key={
                          item.id
                        }
                        className="
                          border-b
                          border-[#EDF2EF]
                          hover:bg-[#FAFCFB]
                        "
                      >

                        {/* OUTLET */}

                        {user?.role ===
                          "ADMIN" && (
                          <td className="px-5 py-4 align-top">

                            <div className="font-semibold text-[#18352D]">
                              {
                                item
                                  .outlet
                                  ?.name
                              }
                            </div>

                            <div className="mt-0.5 text-xs text-gray-400">
                              {
                                item
                                  .outlet
                                  ?.code
                              }
                            </div>

                          </td>
                        )}

                        {/* KODE */}

                        <td className="px-5 py-4 align-top">

                          <span className="font-semibold text-[#35564C]">
                            {
                              item
                                .barang
                                ?.code
                            }
                          </span>

                        </td>

                        {/* BARANG */}

                        <td className="px-5 py-4 align-top">

                          <div className="font-semibold text-[#18352D]">
                            {
                              item
                                .barang
                                ?.name
                            }
                          </div>

                        </td>

                        {/* SATUAN */}

                        <td className="px-5 py-4 text-center align-top">

                          {
                            item
                              .barang
                              ?.unit ||
                            "-"
                          }

                        </td>

                        {/* STOCK */}

                        <td className="px-5 py-4 text-right align-top">

                          <span className="font-bold text-[#18352D]">
                            {formatNumber(
                              stock
                            )}
                          </span>

                        </td>

                        {/* MINIMUM */}

                        <td className="px-5 py-4 text-right align-top">

                          <span className="text-gray-500">
                            {formatNumber(
                              minimum
                            )}
                          </span>

                        </td>

                        {/* COST */}

                        <td className="px-5 py-4 text-right align-top whitespace-nowrap">

                          <span className="font-medium text-[#35564C]">
                            {formatRupiah(
                              averageCost
                            )}
                          </span>

                        </td>

                        {/* NILAI */}

                        <td className="px-5 py-4 text-right align-top whitespace-nowrap">

                          <span className="font-semibold text-[#18352D]">
                            {formatRupiah(
                              nilaiStock
                            )}
                          </span>

                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-4 text-center align-top">

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
                              ${getStatusClass(
                                item
                              )}
                            `}
                          >

                            {status ===
                            "AMAN" ? (
                              <CheckCircle2
                                size={
                                  13
                                }
                              />
                            ) : (
                              <AlertTriangle
                                size={
                                  13
                                }
                              />
                            )}

                            {status}

                          </span>

                        </td>

                      </tr>
                    );
                  }
                )

              )}

            </tbody>

          </table>

        </div>

        {/* TOTAL */}

        {!loading &&
          filteredData.length >
            0 && (
            <div className="flex flex-col gap-4 border-t border-[#E5ECE9] bg-[#FAFCFB] px-5 py-4 md:flex-row md:items-center md:justify-between">

              <div>

                <p className="text-xs text-gray-500">
                  Menampilkan{" "}
                  <span className="font-semibold text-[#35564C]">
                    {formatNumber(
                      filteredData.length
                    )}
                  </span>{" "}
                  barang
                </p>

              </div>

              <div className="flex items-center gap-7">

                <div className="text-right">

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Total Qty
                  </p>

                  <p className="text-sm font-bold text-[#18352D]">
                    {formatNumber(
                      totalQty
                    )}
                  </p>

                </div>

                <div className="text-right">

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Total Nilai
                  </p>

                  <p className="text-sm font-bold text-[#18352D]">
                    {formatRupiah(
                      totalNilai
                    )}
                  </p>

                </div>

              </div>

            </div>
          )}

      </div>

    </div>
  );
}