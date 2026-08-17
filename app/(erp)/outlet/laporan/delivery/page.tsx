"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Search,
  RefreshCw,
  Truck,
  Package,
  CalendarDays,
  FileText,
  Filter,
} from "lucide-react";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type Customer = {
  id: number;
  code: string;
  name: string;
};

type Barang = {
  id: number;
  code: string;
  name: string;
  unit: string;
  sellingPrice: number;
  purchasePrice: number;
};

type DeliveryItem = {
  id: number;
  barangId: number;
  qty: number;
  price: number;
  subtotal: number;
  note?: string | null;
  barang: Barang;
};

type SuratJalan = {
  id: number;
  number: string;
  driver?: string | null;
  vehicleNumber?: string | null;
  expedition?: string | null;
  receiver?: string | null;
  receiveDate?: string | null;
};

type Delivery = {
  id: number;
  number: string;
  deliveryDate: string;
  status: string;
  remarks?: string | null;
  totalQty: number;
  customer: Customer;
  outlet?: Outlet | null;
  suratJalan?: SuratJalan | null;
  items: DeliveryItem[];
};

export default function OutletDeliveryReportPage() {
  const [data, setData] = useState<Delivery[]>([]);
  const [outlet, setOutlet] = useState<Outlet | null>(null);

  // =====================================================
  // ADMIN PUSAT
  // =====================================================

  const [isAdmin, setIsAdmin] = useState(false);

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] =
    useState<string>("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // =====================================================
  // SEARCH
  // =====================================================

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // =====================================================
  // LOAD DATA
  // =====================================================

  async function loadData() {
    try {
      setLoading(true);

      // =================================================
      // AMBIL USER LOGIN
      // =================================================

      const meRes = await fetch("/api/me", {
        cache: "no-store",
      });

      const meJson = await meRes.json();

      if (!meRes.ok || !meJson.success) {
        throw new Error(
          meJson.message || "Gagal mengambil user login"
        );
      }

      const loginUser = meJson.user;

      const role = String(
        loginUser?.role || ""
      ).toUpperCase();

      const adminPusat =
        role === "ADMIN";

      setIsAdmin(adminPusat);

      // =================================================
      // ADMIN PUSAT
      //
      // Bisa melihat semua outlet.
      // =================================================

      if (adminPusat) {
        setOutlet(null);

        const res = await fetch(
          "/api/outlet/laporan/delivery",
          {
            cache: "no-store",
          }
        );

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(
            json.message ||
              "Gagal mengambil laporan Delivery Order"
          );
        }

        const deliveries: Delivery[] =
          Array.isArray(json.data)
            ? json.data
            : [];

        setData(deliveries);

        // =================================================
        // AMBIL LIST OUTLET
        //
        // Prioritas:
        // json.outlets
        // lalu ambil dari data delivery
        // =================================================

        if (Array.isArray(json.outlets)) {
          setOutlets(json.outlets);
        } else {
          const outletMap = new Map<
            number,
            Outlet
          >();

          deliveries.forEach((delivery) => {
            if (delivery.outlet) {
              outletMap.set(
                Number(delivery.outlet.id),
                {
                  id: Number(
                    delivery.outlet.id
                  ),
                  code:
                    delivery.outlet.code,
                  name:
                    delivery.outlet.name,
                }
              );
            }
          });

          setOutlets(
            Array.from(
              outletMap.values()
            ).sort((a, b) =>
              a.name.localeCompare(
                b.name
              )
            )
          );
        }

        return;
      }

      // =================================================
      // ADMIN OUTLET
      //
      // Hanya outlet sendiri.
      // =================================================

      if (
        !loginUser?.outletId ||
        !loginUser?.outlet
      ) {
        setOutlet(null);
        setData([]);
        return;
      }

      const loginOutlet: Outlet = {
        id: Number(
          loginUser.outlet.id
        ),
        code:
          loginUser.outlet.code,
        name:
          loginUser.outlet.name,
      };

      setOutlet(loginOutlet);

      const res = await fetch(
        `/api/outlet/laporan/delivery?outletId=${loginOutlet.id}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil laporan Delivery Order"
        );
      }

      const deliveries: Delivery[] =
        Array.isArray(json.data)
          ? json.data
          : [];

      // =================================================
      // FILTER KETAT OUTLET LOGIN
      // =================================================

      const outletDeliveries =
        deliveries.filter(
          (delivery) =>
            Number(
              delivery.outlet?.id
            ) === loginOutlet.id
        );

      setData(outletDeliveries);
    } catch (error) {
      console.error(
        "LOAD OUTLET DELIVERY REPORT ERROR:",
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
  // PRICE
  // =====================================================

  function getItemPrice(
    item: DeliveryItem
  ) {
    const deliveryPrice =
      Number(item.price || 0);

    if (deliveryPrice > 0) {
      return deliveryPrice;
    }

    const sellingPrice =
      Number(
        item.barang?.sellingPrice || 0
      );

    if (sellingPrice > 0) {
      return sellingPrice;
    }

    return Number(
      item.barang?.purchasePrice || 0
    );
  }

  // =====================================================
  // SUBTOTAL
  // =====================================================

  function getItemSubtotal(
    item: DeliveryItem
  ) {
    const subtotal =
      Number(item.subtotal || 0);

    if (subtotal > 0) {
      return subtotal;
    }

    return (
      Number(item.qty || 0) *
      getItemPrice(item)
    );
  }

  // =====================================================
  // TOTAL DO
  // =====================================================

  function getDeliveryTotal(
    delivery: Delivery
  ) {
    return delivery.items.reduce(
      (sum, item) =>
        sum +
        getItemSubtotal(item),
      0
    );
  }

  // =====================================================
  // TOTAL QTY
  // =====================================================

  function getDeliveryQty(
    delivery: Delivery
  ) {
    return delivery.items.reduce(
      (sum, item) =>
        sum +
        Number(item.qty || 0),
      0
    );
  }

  // =====================================================
  // FILTER
  //
  // ADMIN:
  // - outlet
  // - tanggal
  // - search
  //
  // OUTLET:
  // - search
  // =====================================================

  const filteredData = useMemo(() => {
    const keyword =
      search.toLowerCase().trim();

    return data.filter(
      (delivery) => {
        // =============================================
        // FILTER OUTLET ADMIN
        // =============================================

        if (
          isAdmin &&
          selectedOutletId
        ) {
          if (
            Number(
              delivery.outlet?.id
            ) !==
            Number(
              selectedOutletId
            )
          ) {
            return false;
          }
        }

        // =============================================
        // FILTER TANGGAL ADMIN
        // =============================================

        if (isAdmin) {
          const deliveryDate =
            new Date(
              delivery.deliveryDate
            );

          if (dateFrom) {
            const fromDate =
              new Date(
                `${dateFrom}T00:00:00`
              );

            if (
              deliveryDate <
              fromDate
            ) {
              return false;
            }
          }

          if (dateTo) {
            const toDate =
              new Date(
                `${dateTo}T23:59:59.999`
              );

            if (
              deliveryDate >
              toDate
            ) {
              return false;
            }
          }
        }

        // =============================================
        // SEARCH
        // =============================================

        if (!keyword) {
          return true;
        }

        const text = [
          delivery.number,

          delivery.customer?.code,

          delivery.customer?.name,

          delivery.outlet?.code,

          delivery.outlet?.name,

          delivery.suratJalan?.number,

          ...delivery.items.map(
            (item) =>
              `${item.barang.code} ${item.barang.name}`
          ),
        ]
          .join(" ")
          .toLowerCase();

        return text.includes(
          keyword
        );
      }
    );
  }, [
    data,
    search,
    isAdmin,
    selectedOutletId,
    dateFrom,
    dateTo,
  ]);

  // =====================================================
  // FORMAT
  // =====================================================

  function formatNumber(
    value: number
  ) {
    return Number(
      value || 0
    ).toLocaleString("id-ID");
  }

  function formatRupiah(
    value: number
  ) {
    return `Rp ${formatNumber(
      value
    )}`;
  }

  function formatDate(
    value: string
  ) {
    if (!value) return "-";

    return new Date(
      value
    ).toLocaleDateString(
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

  function statusLabel(
    status: string
  ) {
    switch (
      String(
        status
      ).toUpperCase()
    ) {
      case "DRAFT":
        return "Draft";

      case "RELEASED":
        return "Dikirim";

      case "DELIVERED":
        return "Diterima";

      default:
        return status;
    }
  }

  function statusClass(
    status: string
  ) {
    switch (
      String(
        status
      ).toUpperCase()
    ) {
      case "DELIVERED":
        return "bg-[#E8F4EC] text-[#2F7A4F]";

      case "RELEASED":
        return "bg-[#FFF4DD] text-[#9A6A18]";

      case "DRAFT":
        return "bg-[#EEF2F1] text-[#66736E]";

      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalDelivery =
    filteredData.length;

  const totalQty =
    filteredData.reduce(
      (sum, delivery) =>
        sum +
        getDeliveryQty(
          delivery
        ),
      0
    );

  const totalValue =
    filteredData.reduce(
      (sum, delivery) =>
        sum +
        getDeliveryTotal(
          delivery
        ),
      0
    );

  // =====================================================
  // RESET FILTER
  // =====================================================

  function resetFilter() {
    setSelectedOutletId("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
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
            <Truck size={23} />
          </div>

          <div>

            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Laporan Delivery Order
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Delivery Order yang dikirim dari gudang pusat ke outlet
            </p>

            {!isAdmin && outlet && (
              <p className="mt-1 text-xs font-semibold text-[#497F70]">
                Outlet: {outlet.code} -{" "}
                {outlet.name}
              </p>
            )}

            {isAdmin && (
              <p className="mt-1 text-xs font-semibold text-[#497F70]">
                Admin Pusat · Semua Outlet
              </p>
            )}

          </div>

        </div>

        <button
          type="button"
          onClick={loadData}
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

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Total Delivery
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalDelivery
                )}
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Truck size={19} />
            </div>

          </div>

        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Total Qty
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(
                  totalQty
                )}
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Package size={19} />
            </div>

          </div>

        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Nilai Delivery
              </p>

              <p className="mt-2 text-xl font-bold text-[#18352D]">
                {formatRupiah(
                  totalValue
                )}
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <FileText size={19} />
            </div>

          </div>

        </div>

      </div>

      {/* =================================================
          TABLE
      ================================================= */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        {/* =================================================
            TOOLBAR
        ================================================= */}

        <div className="border-b border-[#E5ECE9] px-5 py-4 md:px-6">

          <div className="flex flex-col gap-4">

            {/* TOP TOOLBAR */}

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

              <div>

                <h2 className="font-semibold text-[#18352D]">
                  Delivery Order Outlet
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  {isAdmin
                    ? "Admin pusat dapat melihat Delivery Order seluruh outlet"
                    : "Hanya menampilkan Delivery Order milik outlet yang sedang login"}
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
                  placeholder="Cari nomor DO, barang..."
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
                FILTER ADMIN PUSAT
                HANYA ADMIN YANG BISA MELIHAT
            ================================================= */}

            {isAdmin && (
              <div className="rounded-2xl border border-[#DDE9E4] bg-[#F8FBF9] p-4">

                <div className="mb-3 flex items-center justify-between">

                  <div className="flex items-center gap-2">

                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF3EF] text-[#497F70]">
                      <Filter size={16} />
                    </div>

                    <div>

                      <p className="text-sm font-bold text-[#18352D]">
                        Filter Laporan
                      </p>

                      <p className="text-xs text-gray-400">
                        Khusus Admin Pusat
                      </p>

                    </div>

                  </div>

                  {(selectedOutletId ||
                    dateFrom ||
                    dateTo) && (
                    <button
                      type="button"
                      onClick={
                        resetFilter
                      }
                      className="
                        text-xs
                        font-semibold
                        text-[#497F70]
                        hover:underline
                      "
                    >
                      Reset Filter
                    </button>
                  )}

                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

                  {/* OUTLET */}

                  <div>

                    <label className="mb-1.5 block text-xs font-semibold text-[#35564C]">
                      Outlet
                    </label>

                    <select
                      value={
                        selectedOutletId
                      }
                      onChange={(e) =>
                        setSelectedOutletId(
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
                        focus:ring-2
                        focus:ring-[#497F70]/10
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

                  {/* TANGGAL DARI */}

                  <div>

                    <label className="mb-1.5 block text-xs font-semibold text-[#35564C]">
                      Tanggal Dari
                    </label>

                    <div className="relative">

                      <CalendarDays
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        type="date"
                        value={
                          dateFrom
                        }
                        onChange={(e) =>
                          setDateFrom(
                            e.target
                              .value
                          )
                        }
                        className="
                          w-full
                          rounded-xl
                          border
                          border-[#D5E5DC]
                          bg-white
                          py-2.5
                          pl-9
                          pr-3
                          text-sm
                          text-[#35564C]
                          outline-none
                          focus:border-[#497F70]
                          focus:ring-2
                          focus:ring-[#497F70]/10
                        "
                      />

                    </div>

                  </div>

                  {/* TANGGAL SAMPAI */}

                  <div>

                    <label className="mb-1.5 block text-xs font-semibold text-[#35564C]">
                      Tanggal Sampai
                    </label>

                    <div className="relative">

                      <CalendarDays
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        type="date"
                        value={
                          dateTo
                        }
                        min={
                          dateFrom ||
                          undefined
                        }
                        onChange={(e) =>
                          setDateTo(
                            e.target
                              .value
                          )
                        }
                        className="
                          w-full
                          rounded-xl
                          border
                          border-[#D5E5DC]
                          bg-white
                          py-2.5
                          pl-9
                          pr-3
                          text-sm
                          text-[#35564C]
                          outline-none
                          focus:border-[#497F70]
                          focus:ring-2
                          focus:ring-[#497F70]/10
                        "
                      />

                    </div>

                  </div>

                </div>

              </div>
            )}

          </div>

        </div>

        {/* =================================================
            TABLE TETAP SEPERTI SEBELUMNYA
        ================================================= */}

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1250px] text-sm">

            <thead>

              <tr className="border-b border-[#DDE9E4] bg-[#F5F8F6]">

                <th className="w-[120px] px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#35564C]">
                  Tanggal
                </th>

                <th className="w-[160px] px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#35564C]">
                  Delivery Order
                </th>

                <th className="w-[160px] px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#35564C]">
                  Surat Jalan
                </th>

                <th className="w-[180px] px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#35564C]">
                  Outlet
                </th>

                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#35564C]">
                  Detail Barang
                </th>

                <th className="w-[120px] px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-[#35564C]">
                  Total Qty
                </th>

                <th className="w-[170px] px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-[#35564C]">
                  Total DO
                </th>

                <th className="w-[130px] px-5 py-4 text-center text-xs font-bold uppercase tracking-wide text-[#35564C]">
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td
                    colSpan={8}
                    className="px-5 py-14 text-center"
                  >

                    <RefreshCw
                      size={20}
                      className="mx-auto mb-2 animate-spin text-[#497F70]"
                    />

                    <p className="text-sm text-gray-500">
                      Memuat laporan...
                    </p>

                  </td>

                </tr>

              ) : filteredData.length === 0 ? (

                <tr>

                  <td
                    colSpan={8}
                    className="px-5 py-14 text-center text-sm text-gray-400"
                  >
                    Belum ada Delivery Order
                    {isAdmin &&
                    (selectedOutletId ||
                      dateFrom ||
                      dateTo)
                      ? " sesuai filter"
                      : " untuk outlet ini"}
                  </td>

                </tr>

              ) : (

                filteredData.map(
                  (delivery) => {

                    const totalDO =
                      getDeliveryTotal(
                        delivery
                      );

                    const totalQtyDO =
                      getDeliveryQty(
                        delivery
                      );

                    return (
                      <tr
                        key={
                          delivery.id
                        }
                        className="
                          border-b
                          border-[#EDF2EF]
                          align-top
                          transition
                          hover:bg-[#FAFCFB]
                        "
                      >

                        {/* TANGGAL */}

                        <td className="px-5 py-5">

                          <div className="flex items-start gap-2">

                            <CalendarDays
                              size={15}
                              className="mt-0.5 shrink-0 text-[#497F70]"
                            />

                            <div>

                              <div className="font-semibold text-[#35564C]">
                                {formatDate(
                                  delivery.deliveryDate
                                )}
                              </div>

                            </div>

                          </div>

                        </td>

                        {/* DELIVERY ORDER */}

                        <td className="px-5 py-5">

                          <div className="font-bold text-[#18352D]">
                            {
                              delivery.number
                            }
                          </div>

                          {delivery.remarks && (
                            <div className="mt-1.5 max-w-[150px] text-xs leading-5 text-gray-400">
                              {
                                delivery.remarks
                              }
                            </div>
                          )}

                        </td>

                        {/* SURAT JALAN */}

                        <td className="px-5 py-5">

                          <div className="font-semibold text-[#35564C]">
                            {
                              delivery
                                .suratJalan
                                ?.number ||
                              "-"
                            }
                          </div>

                          {delivery
                            .suratJalan
                            ?.driver && (
                            <div className="mt-1 text-xs text-gray-400">
                              Driver:{" "}
                              {
                                delivery
                                  .suratJalan
                                  .driver
                              }
                            </div>
                          )}

                          {delivery
                            .suratJalan
                            ?.vehicleNumber && (
                            <div className="text-xs text-gray-400">
                              {
                                delivery
                                  .suratJalan
                                  .vehicleNumber
                              }
                            </div>
                          )}

                        </td>

                        {/* OUTLET */}

                        <td className="px-5 py-5">

                          <div className="font-semibold text-[#18352D]">
                            {
                              delivery
                                .outlet
                                ?.name ||
                              "-"
                            }
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            {
                              delivery
                                .outlet
                                ?.code ||
                              "-"
                            }
                          </div>

                        </td>

                        {/* DETAIL BARANG */}

                        <td className="px-5 py-4">

                          <div className="space-y-2">

                            {delivery.items.map(
                              (
                                item
                              ) => {

                                const harga =
                                  getItemPrice(
                                    item
                                  );

                                const subtotal =
                                  getItemSubtotal(
                                    item
                                  );

                                return (
                                  <div
                                    key={
                                      item.id
                                    }
                                    className="
                                      rounded-xl
                                      border
                                      border-[#E5ECE9]
                                      bg-[#FAFCFB]
                                      px-3
                                      py-2.5
                                    "
                                  >

                                    <div className="flex items-start justify-between gap-4">

                                      <div className="min-w-0">

                                        <div className="truncate font-semibold text-[#18352D]">
                                          {
                                            item
                                              .barang
                                              ?.name
                                          }
                                        </div>

                                        <div className="mt-0.5 text-xs text-gray-400">
                                          {
                                            item
                                              .barang
                                              ?.code
                                          }
                                        </div>

                                      </div>

                                      <div className="shrink-0 text-right">

                                        <div className="font-semibold text-[#35564C]">
                                          {formatNumber(
                                            item.qty
                                          )}{" "}
                                          {
                                            item
                                              .barang
                                              ?.unit
                                          }
                                        </div>

                                      </div>

                                    </div>

                                    <div className="mt-2 flex items-center justify-between border-t border-[#E8EFEB] pt-2 text-xs">

                                      <span className="text-gray-400">
                                        {formatRupiah(
                                          harga
                                        )}{" "}
                                        /{" "}
                                        {
                                          item
                                            .barang
                                            ?.unit
                                        }
                                      </span>

                                      <span className="font-semibold text-[#18352D]">
                                        {formatRupiah(
                                          subtotal
                                        )}
                                      </span>

                                    </div>

                                  </div>
                                );
                              }
                            )}

                          </div>

                        </td>

                        {/* TOTAL QTY */}

                        <td className="px-5 py-5 text-right">

                          <div className="font-bold text-[#18352D]">
                            {formatNumber(
                              totalQtyDO
                            )}
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            {
                              delivery
                                .items
                                .length
                            }{" "}
                            jenis barang
                          </div>

                        </td>

                        {/* TOTAL DO */}

                        <td className="px-5 py-5 text-right">

                          <div className="rounded-xl bg-[#EAF3EF] px-3 py-3">

                            <div className="text-[10px] font-bold uppercase tracking-wide text-[#497F70]">
                              Total Delivery
                            </div>

                            <div className="mt-1 whitespace-nowrap text-base font-bold text-[#18352D]">
                              {formatRupiah(
                                totalDO
                              )}
                            </div>

                          </div>

                        </td>

                        {/* STATUS */}

                        <td className="px-5 py-5 text-center">

                          <span
                            className={`
                              inline-flex
                              items-center
                              justify-center
                              rounded-full
                              px-3
                              py-1.5
                              text-xs
                              font-bold
                              ${statusClass(
                                delivery.status
                              )}
                            `}
                          >
                            {statusLabel(
                              delivery.status
                            )}
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

      </div>

    </div>
  );
}