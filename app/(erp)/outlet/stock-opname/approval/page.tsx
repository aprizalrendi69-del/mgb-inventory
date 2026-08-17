"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Search,
  RefreshCw,
  ClipboardCheck,
  Package,
  CheckCircle2,
  AlertTriangle,
  Eye,
  X,
  UserCheck,
  Trash2,
  CalendarDays,
} from "lucide-react";

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
  purchasePrice: number;
  sellingPrice: number;
};

type StockOpnameItem = {
  id: number;
  opnameId: number;
  barangId: number;
  systemQty: number;
  physicalQty: number;
  difference: number;
  note?: string | null;
  barang: Barang;
};

type StockOpname = {
  id: number;
  code: string;
  date: string;
  status: string;
  createdBy?: number | null;
  approvedBy?: number | null;
  createdAt: string;
  updatedAt: string;
  outlet: Outlet;
  items: StockOpnameItem[];
};

type LoginUser = {
  id: number;
  fullname: string;
  role: string;
  outletId?: number | null;
};

export default function OutletStockOpnameApprovalPage() {
  const [data, setData] = useState<StockOpname[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [user, setUser] = useState<LoginUser | null>(null);

  const [search, setSearch] = useState("");

  const [outletFilter, setOutletFilter] =
    useState("");

  const [dateFrom, setDateFrom] =
    useState("");

  const [dateTo, setDateTo] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [approving, setApproving] =
    useState<number | null>(null);

  const [deleting, setDeleting] =
    useState<number | null>(null);

  const [selected, setSelected] =
    useState<StockOpname | null>(null);

  // =====================================================
  // ROLE
  // =====================================================

  const isAdminPusat =
    String(user?.role || "").toUpperCase() ===
    "ADMIN";

  // =====================================================
  // LOAD DATA
  // =====================================================

  async function loadData(
    customFilters?: {
      outletId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      // -------------------------------------------------
      // FILTER HANYA DIKIRIM ADMIN PUSAT
      // -------------------------------------------------

      if (isAdminPusat) {
        const selectedOutlet =
          customFilters?.outletId ??
          outletFilter;

        const selectedDateFrom =
          customFilters?.dateFrom ??
          dateFrom;

        const selectedDateTo =
          customFilters?.dateTo ??
          dateTo;

        if (selectedOutlet) {
          params.set(
            "outletId",
            selectedOutlet
          );
        }

        if (selectedDateFrom) {
          params.set(
            "dateFrom",
            selectedDateFrom
          );
        }

        if (selectedDateTo) {
          params.set(
            "dateTo",
            selectedDateTo
          );
        }
      }

      const query =
        params.toString();

      const res = await fetch(
        query
          ? `/api/outlet/stock-opname/approval?${query}`
          : "/api/outlet/stock-opname/approval",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil data stock opname"
        );
      }

      // -------------------------------------------------
      // USER
      // -------------------------------------------------

      setUser(
        json.user || null
      );

      // -------------------------------------------------
      // OUTLET USER
      // -------------------------------------------------

      setOutlet(
        json.outlet || null
      );

      // -------------------------------------------------
      // DROPDOWN OUTLET
      // HANYA ADMIN PUSAT
      // -------------------------------------------------

      setOutlets(
        Array.isArray(json.outlets)
          ? json.outlets
          : []
      );

      setData(
        Array.isArray(json.data)
          ? json.data
          : []
      );
    } catch (error: any) {
      console.error(
        "LOAD APPROVAL STOCK OPNAME ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal mengambil data stock opname"
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
  // APPLY FILTER
  // =====================================================

  function handleApplyFilter() {
    if (!isAdminPusat) {
      return;
    }

    loadData({
      outletId: outletFilter,
      dateFrom,
      dateTo,
    });
  }

  // =====================================================
  // RESET FILTER
  // =====================================================

  function handleResetFilter() {
    if (!isAdminPusat) {
      return;
    }

    setOutletFilter("");
    setDateFrom("");
    setDateTo("");

    loadData({
      outletId: "",
      dateFrom: "",
      dateTo: "",
    });
  }

  // =====================================================
  // FILTER SEARCH
  // =====================================================

  const filteredData = useMemo(() => {
    const keyword =
      search.toLowerCase().trim();

    if (!keyword) {
      return data;
    }

    return data.filter((item) => {
      const text = [
        item.code,
        item.outlet?.code,
        item.outlet?.name,

        ...item.items.map(
          (detail) =>
            `${detail.barang?.code} ${detail.barang?.name}`
        ),
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(keyword);
    });
  }, [data, search]);

  // =====================================================
  // FORMAT
  // =====================================================

  function formatNumber(value: number) {
    return Number(
      value || 0
    ).toLocaleString("id-ID");
  }

  function formatDate(value: string) {
    if (!value) return "-";

    return new Date(
      value
    ).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  // =====================================================
  // STATUS
  // =====================================================

  function statusLabel(status: string) {
    switch (
      String(status).toUpperCase()
    ) {
      case "COUNTING":
        return "Menunggu Approval";

      case "APPROVED":
        return "Approved";

      default:
        return status;
    }
  }

  function statusClass(status: string) {
    switch (
      String(status).toUpperCase()
    ) {
      case "APPROVED":
        return "bg-[#E8F4EC] text-[#2F7A4F]";

      case "COUNTING":
        return "bg-[#FFF4DD] text-[#9A6A18]";

      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalOpname =
    filteredData.length;

  const totalWaiting =
    filteredData.filter(
      (item) =>
        String(item.status).toUpperCase() ===
        "COUNTING"
    ).length;

  const totalApproved =
    filteredData.filter(
      (item) =>
        String(item.status).toUpperCase() ===
        "APPROVED"
    ).length;

  // =====================================================
  // DETAIL SUMMARY
  // =====================================================

  function getTotalSystem(
    opname: StockOpname
  ) {
    return opname.items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.systemQty || 0
        ),
      0
    );
  }

  function getTotalPhysical(
    opname: StockOpname
  ) {
    return opname.items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.physicalQty || 0
        ),
      0
    );
  }

  function getTotalDifference(
    opname: StockOpname
  ) {
    return opname.items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.difference || 0
        ),
      0
    );
  }

  function getDifferenceCount(
    opname: StockOpname
  ) {
    return opname.items.filter(
      (item) =>
        Number(
          item.difference || 0
        ) !== 0
    ).length;
  }

  // =====================================================
  // APPROVE
  // HANYA ADMIN PUSAT
  // =====================================================

  async function handleApprove(
    opname: StockOpname
  ) {
    if (!isAdminPusat) {
      return;
    }

    if (
      String(opname.status).toUpperCase() !==
      "COUNTING"
    ) {
      return;
    }

    const difference =
      getTotalDifference(opname);

    const message =
      difference === 0
        ? `Approve ${opname.code}?\n\nTidak ada selisih stock.`
        : `Approve ${opname.code}?\n\nTotal selisih: ${
            difference > 0 ? "+" : ""
          }${formatNumber(
            difference
          )}\n\nSetelah approve, stock outlet akan disesuaikan dengan stock fisik.`;

    const confirmed =
      window.confirm(message);

    if (!confirmed) {
      return;
    }

    try {
      setApproving(opname.id);

      const res = await fetch(
        "/api/outlet/stock-opname/approval",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            opnameId:
              opname.id,
          }),
        }
      );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            "Gagal approve stock opname"
        );
      }

      alert(
        "Stock Opname berhasil diapprove.\nStock outlet sudah diperbarui."
      );

      setSelected(null);

      await loadData();
    } catch (error: any) {
      console.error(
        "APPROVE STOCK OPNAME ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal approve stock opname"
      );
    } finally {
      setApproving(null);
    }
  }

  // =====================================================
  // DELETE
  // HANYA ADMIN PUSAT
  // =====================================================

  async function handleDelete(
    opname: StockOpname
  ) {
    if (!isAdminPusat) {
      return;
    }

    if (
      String(opname.status).toUpperCase() !==
      "COUNTING"
    ) {
      alert(
        "Stock opname yang sudah diproses tidak dapat dihapus."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Hapus Stock Opname ${opname.code}?\n\nData stock opname dan detail barang akan dihapus.\n\nStock outlet tidak akan berubah.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(opname.id);

      const res = await fetch(
        `/api/outlet/stock-opname/approval?opnameId=${opname.id}`,
        {
          method: "DELETE",
        }
      );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
            "Gagal menghapus stock opname"
        );
      }

      alert(
        json.message ||
          "Stock Opname berhasil dihapus."
      );

      if (
        selected?.id ===
        opname.id
      ) {
        setSelected(null);
      }

      await loadData();
    } catch (error: any) {
      console.error(
        "DELETE STOCK OPNAME ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal menghapus stock opname"
      );
    } finally {
      setDeleting(null);
    }
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
            <ClipboardCheck size={23} />
          </div>

          <div>

            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Approval Stock Opname
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Persetujuan hasil stock opname outlet
            </p>

            {outlet && (
              <p className="mt-1 text-xs font-semibold text-[#497F70]">
                Outlet:{" "}
                {outlet.code} -{" "}
                {outlet.name}
              </p>
            )}

          </div>

        </div>

        <button
          type="button"
          onClick={() =>
            loadData()
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
          SUMMARY
      ================================================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Total Opname
          </p>

          <p className="mt-2 text-2xl font-bold text-[#18352D]">
            {formatNumber(
              totalOpname
            )}
          </p>

        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Menunggu Approval
              </p>

              <p className="mt-2 text-2xl font-bold text-[#9A6A18]">
                {formatNumber(
                  totalWaiting
                )}
              </p>

            </div>

            <AlertTriangle
              size={21}
              className="text-[#9A6A18]"
            />

          </div>

        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Sudah Approved
              </p>

              <p className="mt-2 text-2xl font-bold text-[#2F7A4F]">
                {formatNumber(
                  totalApproved
                )}
              </p>

            </div>

            <CheckCircle2
              size={21}
              className="text-[#2F7A4F]"
            />

          </div>

        </div>

      </div>

      {/* =================================================
          TABLE CONTAINER
      ================================================= */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        {/* =================================================
            TOOLBAR
        ================================================= */}

        <div className="border-b border-[#E5ECE9] px-5 py-4 md:px-6">

          <div className="flex flex-col gap-4">

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

              <div>

                <h2 className="font-semibold text-[#18352D]">
                  Daftar Stock Opname
                </h2>

                <p className="mt-1 text-xs text-gray-500">

                  {isAdminPusat
                    ? "Admin Pusat dapat melakukan filter, approve, dan hapus."
                    : "Anda hanya dapat melihat stock opname sesuai outlet Anda."}

                </p>

              </div>

              <div className="relative w-full md:w-80">

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
                  placeholder="Cari nomor opname atau barang..."
                  className="
                    w-full
                    rounded-xl
                    border
                    border-[#D5E5DC]
                    bg-[#FAFCFB]
                    py-2.5
                    pl-9
                    pr-4
                    text-sm
                    outline-none
                    focus:border-[#497F70]
                  "
                />

              </div>

            </div>

            {/* =================================================
                FILTER ADMIN PUSAT SAJA
            ================================================= */}

            {isAdminPusat && (
              <div className="rounded-xl border border-[#DDE9E4] bg-[#F8FBF9] p-4">

                <div className="mb-3 flex items-center gap-2">

                  <CalendarDays
                    size={16}
                    className="text-[#497F70]"
                  />

                  <span className="text-sm font-semibold text-[#35564C]">
                    Filter Stock Opname
                  </span>

                  <span className="rounded-full bg-[#EAF3EF] px-2 py-0.5 text-[10px] font-bold text-[#497F70]">
                    ADMIN PUSAT
                  </span>

                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">

                  {/* OUTLET */}

                  <div>

                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                      Outlet
                    </label>

                    <select
                      value={
                        outletFilter
                      }
                      onChange={(e) =>
                        setOutletFilter(
                          e.target.value
                        )
                      }
                      className="
                        w-full
                        rounded-xl
                        border
                        border-[#D5E5DC]
                        bg-white
                        px-3
                        py-2.5
                        text-sm
                        text-[#35564C]
                        outline-none
                        focus:border-[#497F70]
                      "
                    >

                      <option value="">
                        Semua Outlet
                      </option>

                      {outlets.map(
                        (item) => (
                          <option
                            key={
                              item.id
                            }
                            value={
                              item.id
                            }
                          >
                            {item.code} -{" "}
                            {item.name}
                          </option>
                        )
                      )}

                    </select>

                  </div>

                  {/* DATE FROM */}

                  <div>

                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                      Tanggal Dari
                    </label>

                    <input
                      type="date"
                      value={
                        dateFrom
                      }
                      onChange={(e) =>
                        setDateFrom(
                          e.target.value
                        )
                      }
                      className="
                        w-full
                        rounded-xl
                        border
                        border-[#D5E5DC]
                        bg-white
                        px-3
                        py-2.5
                        text-sm
                        text-[#35564C]
                        outline-none
                        focus:border-[#497F70]
                      "
                    />

                  </div>

                  {/* DATE TO */}

                  <div>

                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                      Tanggal Sampai
                    </label>

                    <input
                      type="date"
                      value={
                        dateTo
                      }
                      onChange={(e) =>
                        setDateTo(
                          e.target.value
                        )
                      }
                      className="
                        w-full
                        rounded-xl
                        border
                        border-[#D5E5DC]
                        bg-white
                        px-3
                        py-2.5
                        text-sm
                        text-[#35564C]
                        outline-none
                        focus:border-[#497F70]
                      "
                    />

                  </div>

                  {/* BUTTON */}

                  <div className="flex items-end gap-2">

                    <button
                      type="button"
                      onClick={
                        handleApplyFilter
                      }
                      disabled={
                        loading
                      }
                      className="
                        flex-1
                        rounded-xl
                        bg-[#497F70]
                        px-4
                        py-2.5
                        text-sm
                        font-semibold
                        text-white
                        hover:bg-[#3F7063]
                        disabled:opacity-50
                      "
                    >
                      Terapkan
                    </button>

                    <button
                      type="button"
                      onClick={
                        handleResetFilter
                      }
                      disabled={
                        loading
                      }
                      className="
                        rounded-xl
                        border
                        border-[#D5E5DC]
                        bg-white
                        px-4
                        py-2.5
                        text-sm
                        font-semibold
                        text-[#35564C]
                        hover:bg-[#F5F8F6]
                        disabled:opacity-50
                      "
                    >
                      Reset
                    </button>

                  </div>

                </div>

              </div>
            )}

          </div>

        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="overflow-x-auto">

          <table className="min-w-[1100px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Tanggal
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Nomor Opname
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Outlet
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Barang
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Sistem
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Fisik
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Selisih
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
                    className="px-5 py-12 text-center"
                  >

                    <RefreshCw
                      size={20}
                      className="mx-auto mb-2 animate-spin text-[#497F70]"
                    />

                    <p className="text-sm text-gray-500">
                      Memuat stock opname...
                    </p>

                  </td>

                </tr>

              ) : filteredData.length === 0 ? (

                <tr>

                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-sm text-gray-400"
                  >
                    Belum ada stock opname
                  </td>

                </tr>

              ) : (

                filteredData.map(
                  (opname) => {

                    const system =
                      getTotalSystem(
                        opname
                      );

                    const physical =
                      getTotalPhysical(
                        opname
                      );

                    const difference =
                      getTotalDifference(
                        opname
                      );

                    const differenceCount =
                      getDifferenceCount(
                        opname
                      );

                    const waiting =
                      String(
                        opname.status
                      ).toUpperCase() ===
                      "COUNTING";

                    return (
                      <tr
                        key={
                          opname.id
                        }
                        className="
                          border-b
                          border-[#EDF2EF]
                          hover:bg-[#FAFCFB]
                        "
                      >

                        {/* TANGGAL */}

                        <td className="px-5 py-4 align-top">

                          <span className="text-[#35564C]">
                            {formatDate(
                              opname.date
                            )}
                          </span>

                        </td>

                        {/* NOMOR */}

                        <td className="px-5 py-4 align-top">

                          <div className="font-semibold text-[#18352D]">
                            {
                              opname.code
                            }
                          </div>

                        </td>

                        {/* OUTLET */}

                        <td className="px-5 py-4 align-top">

                          <div className="font-semibold text-[#18352D]">
                            {
                              opname
                                .outlet
                                ?.code
                            }
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            {
                              opname
                                .outlet
                                ?.name
                            }
                          </div>

                        </td>

                        {/* BARANG */}

                        <td className="px-5 py-4 text-center align-top">

                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF3EF] px-3 py-1 text-xs font-semibold text-[#497F70]">

                            <Package
                              size={13}
                            />

                            {formatNumber(
                              opname
                                .items
                                .length
                            )}

                          </span>

                        </td>

                        {/* SYSTEM */}

                        <td className="px-5 py-4 text-right align-top">

                          <span className="font-semibold text-gray-600">
                            {formatNumber(
                              system
                            )}
                          </span>

                        </td>

                        {/* PHYSICAL */}

                        <td className="px-5 py-4 text-right align-top">

                          <span className="font-semibold text-[#18352D]">
                            {formatNumber(
                              physical
                            )}
                          </span>

                        </td>

                        {/* DIFFERENCE */}

                        <td className="px-5 py-4 text-right align-top">

                          <div
                            className={`font-bold ${
                              difference >
                              0
                                ? "text-[#2F7A4F]"
                                : difference <
                                  0
                                ? "text-[#C84B4B]"
                                : "text-gray-400"
                            }`}
                          >

                            {difference >
                            0
                              ? "+"
                              : ""}

                            {formatNumber(
                              difference
                            )}

                          </div>

                          {differenceCount >
                            0 && (
                            <div className="mt-1 text-[11px] text-gray-400">
                              {
                                differenceCount
                              }{" "}
                              barang selisih
                            </div>
                          )}

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
                              ${statusClass(
                                opname.status
                              )}
                            `}
                          >

                            {String(
                              opname.status
                            ).toUpperCase() ===
                            "APPROVED" ? (
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

                            {statusLabel(
                              opname.status
                            )}

                          </span>

                        </td>

                        {/* AKSI */}

                        <td className="px-5 py-4 text-center align-top">

                          <div className="flex items-center justify-center gap-2">

                            {/* DETAIL
                                SEMUA ROLE */}
                            <button
                              type="button"
                              onClick={() =>
                                setSelected(
                                  opname
                                )
                              }
                              className="
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-lg
                                border
                                border-[#D5E5DC]
                                bg-white
                                px-3
                                py-2
                                text-xs
                                font-semibold
                                text-[#35564C]
                                hover:bg-[#F5F8F6]
                              "
                            >

                              <Eye
                                size={14}
                              />

                              Detail

                            </button>

                            {/* APPROVE
                                ADMIN PUSAT SAJA */}

                            {isAdminPusat &&
                              waiting && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleApprove(
                                      opname
                                    )
                                  }
                                  disabled={
                                    approving ===
                                      opname.id ||
                                    deleting ===
                                      opname.id
                                  }
                                  className="
                                    inline-flex
                                    items-center
                                    gap-1.5
                                    rounded-lg
                                    bg-[#497F70]
                                    px-3
                                    py-2
                                    text-xs
                                    font-semibold
                                    text-white
                                    hover:bg-[#3F7063]
                                    disabled:opacity-50
                                  "
                                >

                                  {approving ===
                                  opname.id ? (
                                    <RefreshCw
                                      size={
                                        14
                                      }
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <CheckCircle2
                                      size={
                                        14
                                      }
                                    />
                                  )}

                                  Approve

                                </button>
                              )}

                            {/* DELETE
                                ADMIN PUSAT SAJA */}

                            {isAdminPusat &&
                              waiting && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDelete(
                                      opname
                                    )
                                  }
                                  disabled={
                                    deleting ===
                                      opname.id ||
                                    approving ===
                                      opname.id
                                  }
                                  title="Hapus Stock Opname"
                                  className="
                                    inline-flex
                                    items-center
                                    justify-center
                                    rounded-lg
                                    border
                                    border-[#F0CACA]
                                    bg-[#FFF7F7]
                                    p-2
                                    text-[#C84B4B]
                                    hover:bg-[#FDECEC]
                                    disabled:opacity-50
                                  "
                                >

                                  {deleting ===
                                  opname.id ? (
                                    <RefreshCw
                                      size={
                                        14
                                      }
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Trash2
                                      size={
                                        14
                                      }
                                    />
                                  )}

                                </button>
                              )}

                          </div>

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

      {/* =================================================
          MODAL DETAIL
      ================================================= */}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-[#E5ECE9] px-6 py-5">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">

                  <ClipboardCheck
                    size={19}
                  />

                </div>

                <div>

                  <h2 className="font-bold text-[#18352D]">
                    {
                      selected.code
                    }
                  </h2>

                  <p className="text-xs text-gray-500">
                    {formatDate(
                      selected.date
                    )}
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelected(
                    null
                  )
                }
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >

                <X size={20} />

              </button>

            </div>

            {/* INFO */}

            <div className="border-b border-[#E5ECE9] bg-[#FAFCFB] px-6 py-4">

              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Outlet
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#18352D]">
                    {
                      selected
                        .outlet
                        ?.code
                    }
                  </p>

                  <p className="text-xs text-gray-400">
                    {
                      selected
                        .outlet
                        ?.name
                    }
                  </p>

                </div>

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Barang
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#18352D]">
                    {formatNumber(
                      selected
                        .items
                        .length
                    )}
                  </p>

                </div>

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Sistem
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#18352D]">
                    {formatNumber(
                      getTotalSystem(
                        selected
                      )
                    )}
                  </p>

                </div>

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Fisik
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#18352D]">
                    {formatNumber(
                      getTotalPhysical(
                        selected
                      )
                    )}
                  </p>

                </div>

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Selisih
                  </p>

                  <p
                    className={`mt-1 text-sm font-bold ${
                      getTotalDifference(
                        selected
                      ) === 0
                        ? "text-[#2F7A4F]"
                        : "text-[#C84B4B]"
                    }`}
                  >

                    {getTotalDifference(
                      selected
                    ) > 0
                      ? "+"
                      : ""}

                    {formatNumber(
                      getTotalDifference(
                        selected
                      )
                    )}

                  </p>

                </div>

              </div>

            </div>

            {/* DETAIL TABLE */}

            <div className="max-h-[50vh] overflow-auto">

              <table className="min-w-[900px] w-full text-sm">

                <thead className="sticky top-0 bg-[#F5F8F6]">

                  <tr className="border-b border-[#E5ECE9]">

                    <th className="px-5 py-3 text-left font-semibold text-[#35564C]">
                      Kode
                    </th>

                    <th className="px-5 py-3 text-left font-semibold text-[#35564C]">
                      Barang
                    </th>

                    <th className="px-5 py-3 text-center font-semibold text-[#35564C]">
                      Satuan
                    </th>

                    <th className="px-5 py-3 text-right font-semibold text-[#35564C]">
                      Sistem
                    </th>

                    <th className="px-5 py-3 text-right font-semibold text-[#35564C]">
                      Fisik
                    </th>

                    <th className="px-5 py-3 text-right font-semibold text-[#35564C]">
                      Selisih
                    </th>

                    <th className="px-5 py-3 text-left font-semibold text-[#35564C]">
                      Catatan
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {selected.items.map(
                    (item) => {

                      const difference =
                        Number(
                          item.difference ||
                            0
                        );

                      return (
                        <tr
                          key={
                            item.id
                          }
                          className="border-b border-[#EDF2EF]"
                        >

                          <td className="px-5 py-3">
                            <span className="font-semibold text-[#35564C]">
                              {
                                item
                                  .barang
                                  ?.code
                              }
                            </span>
                          </td>

                          <td className="px-5 py-3">
                            <span className="font-semibold text-[#18352D]">
                              {
                                item
                                  .barang
                                  ?.name
                              }
                            </span>
                          </td>

                          <td className="px-5 py-3 text-center text-gray-500">
                            {
                              item
                                .barang
                                ?.unit
                            }
                          </td>

                          <td className="px-5 py-3 text-right">
                            {formatNumber(
                              item.systemQty
                            )}
                          </td>

                          <td className="px-5 py-3 text-right font-semibold">
                            {formatNumber(
                              item.physicalQty
                            )}
                          </td>

                          <td className="px-5 py-3 text-right">

                            <span
                              className={`font-bold ${
                                difference >
                                0
                                  ? "text-[#2F7A4F]"
                                  : difference <
                                    0
                                  ? "text-[#C84B4B]"
                                  : "text-gray-400"
                              }`}
                            >

                              {difference >
                              0
                                ? "+"
                                : ""}

                              {formatNumber(
                                difference
                              )}

                            </span>

                          </td>

                          <td className="px-5 py-3 text-gray-500">
                            {
                              item.note ||
                              "-"
                            }
                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

            {/* FOOTER */}

            <div className="flex flex-col gap-3 border-t border-[#E5ECE9] bg-[#FAFCFB] px-6 py-4 md:flex-row md:items-center md:justify-between">

              <div className="flex items-center gap-2 text-xs text-gray-500">

                <UserCheck
                  size={15}
                  className="text-[#497F70]"
                />

                Status:

                <span
                  className={`
                    rounded-full
                    px-2.5
                    py-1
                    font-semibold
                    ${statusClass(
                      selected.status
                    )}
                  `}
                >
                  {statusLabel(
                    selected.status
                  )}
                </span>

              </div>

              <div className="flex items-center gap-2">

                <button
                  type="button"
                  onClick={() =>
                    setSelected(
                      null
                    )
                  }
                  className="
                    rounded-xl
                    border
                    border-[#D5E5DC]
                    bg-white
                    px-4
                    py-2.5
                    text-sm
                    font-semibold
                    text-[#35564C]
                    hover:bg-[#F5F8F6]
                  "
                >
                  Tutup
                </button>

                {/* APPROVE MODAL
                    ADMIN PUSAT SAJA */}

                {isAdminPusat &&
                  String(
                    selected.status
                  ).toUpperCase() ===
                    "COUNTING" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleApprove(
                          selected
                        )
                      }
                      disabled={
                        approving ===
                          selected.id ||
                        deleting ===
                          selected.id
                      }
                      className="
                        inline-flex
                        items-center
                        gap-2
                        rounded-xl
                        bg-[#497F70]
                        px-5
                        py-2.5
                        text-sm
                        font-semibold
                        text-white
                        hover:bg-[#3F7063]
                        disabled:opacity-50
                      "
                    >

                      {approving ===
                      selected.id ? (
                        <RefreshCw
                          size={
                            16
                          }
                          className="animate-spin"
                        />
                      ) : (
                        <CheckCircle2
                          size={
                            16
                          }
                        />
                      )}

                      Approve Stock Opname

                    </button>
                  )}

                {/* DELETE MODAL
                    ADMIN PUSAT SAJA */}

                {isAdminPusat &&
                  String(
                    selected.status
                  ).toUpperCase() ===
                    "COUNTING" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(
                          selected
                        )
                      }
                      disabled={
                        deleting ===
                          selected.id ||
                        approving ===
                          selected.id
                      }
                      className="
                        inline-flex
                        items-center
                        gap-2
                        rounded-xl
                        border
                        border-[#F0CACA]
                        bg-[#FFF7F7]
                        px-4
                        py-2.5
                        text-sm
                        font-semibold
                        text-[#C84B4B]
                        hover:bg-[#FDECEC]
                        disabled:opacity-50
                      "
                    >

                      {deleting ===
                      selected.id ? (
                        <RefreshCw
                          size={
                            16
                          }
                          className="animate-spin"
                        />
                      ) : (
                        <Trash2
                          size={
                            16
                          }
                        />
                      )}

                      Hapus

                    </button>
                  )}

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}