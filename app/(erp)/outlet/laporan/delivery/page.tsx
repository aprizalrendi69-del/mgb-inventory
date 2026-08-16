"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Search,
  RefreshCw,
  Truck,
  Package,
  CalendarDays,
  FileText,
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

      if (!loginUser?.outletId || !loginUser?.outlet) {
        setOutlet(null);
        setData([]);
        return;
      }

      const loginOutlet: Outlet = {
        id: Number(loginUser.outlet.id),
        code: loginUser.outlet.code,
        name: loginUser.outlet.name,
      };

      setOutlet(loginOutlet);

      // =================================================
      // AMBIL DELIVERY
      // =================================================

      const res = await fetch(
        `/api/outlet/laporan/delivery?outletId=${loginOutlet.id}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Gagal mengambil laporan Delivery Order"
        );
      }

      const deliveries: Delivery[] = Array.isArray(json.data)
        ? json.data
        : [];

      // =================================================
      // FILTER KETAT BERDASARKAN OUTLET LOGIN
      //
      // DO tanpa outletId TIDAK ditampilkan.
      // DO outlet lain TIDAK ditampilkan.
      // =================================================

      const outletDeliveries = deliveries.filter(
        (delivery) =>
          Number(delivery.outlet?.id) === loginOutlet.id
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
  // EFFECTIVE PRICE
  // =====================================================
  //
  // Prioritas:
  //
  // 1. delivery item price
  // 2. barang sellingPrice
  // 3. barang purchasePrice
  //
  // Jadi kalau item.price = 0, harga tetap tampil.
  // =====================================================

  function getItemPrice(item: DeliveryItem) {
    const deliveryPrice = Number(item.price || 0);

    if (deliveryPrice > 0) {
      return deliveryPrice;
    }

    const sellingPrice = Number(
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

  function getItemSubtotal(item: DeliveryItem) {
    const subtotal = Number(item.subtotal || 0);

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

  function getDeliveryTotal(delivery: Delivery) {
    return delivery.items.reduce(
      (sum, item) =>
        sum + getItemSubtotal(item),
      0
    );
  }

  // =====================================================
  // TOTAL QTY DO
  // =====================================================

  function getDeliveryQty(delivery: Delivery) {
    return delivery.items.reduce(
      (sum, item) =>
        sum + Number(item.qty || 0),
      0
    );
  }

  // =====================================================
  // FILTER SEARCH
  // =====================================================

  const filteredData = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) {
      return data;
    }

    return data.filter((delivery) => {
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

      return text.includes(keyword);
    });
  }, [data, search]);

  // =====================================================
  // FORMAT
  // =====================================================

  function formatNumber(value: number) {
    return Number(value || 0).toLocaleString(
      "id-ID"
    );
  }

  function formatRupiah(value: number) {
    return `Rp ${formatNumber(value)}`;
  }

  function formatDate(value: string) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString(
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

  function statusLabel(status: string) {
    switch (status) {
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

  function statusClass(status: string) {
    switch (status) {
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

  const totalDelivery = filteredData.length;

  const totalQty = filteredData.reduce(
    (sum, delivery) =>
      sum + getDeliveryQty(delivery),
    0
  );

  const totalValue = filteredData.reduce(
    (sum, delivery) =>
      sum + getDeliveryTotal(delivery),
    0
  );

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
              Delivery Order yang dikirim dari
              gudang pusat ke outlet
            </p>

            {outlet && (
              <p className="mt-1 text-xs font-semibold text-[#497F70]">
                Outlet: {outlet.code} - {outlet.name}
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

        {/* TOTAL DELIVERY */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Total Delivery
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(totalDelivery)}
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Truck size={19} />
            </div>

          </div>

        </div>

        {/* TOTAL QTY */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Total Qty
              </p>

              <p className="mt-2 text-2xl font-bold text-[#18352D]">
                {formatNumber(totalQty)}
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Package size={19} />
            </div>

          </div>

        </div>

        {/* TOTAL VALUE */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Nilai Delivery
              </p>

              <p className="mt-2 text-xl font-bold text-[#18352D]">
                {formatRupiah(totalValue)}
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

        {/* TOOLBAR */}

        <div className="flex flex-col gap-4 border-b border-[#E5ECE9] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">

          <div>

            <h2 className="font-semibold text-[#18352D]">
              Delivery Order Outlet
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Hanya menampilkan Delivery Order
              milik outlet yang sedang login
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
                setSearch(e.target.value)
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

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="min-w-[1400px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Tanggal
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Delivery Order
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Surat Jalan
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Outlet
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Barang
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Qty
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Harga
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Subtotal
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Total DO
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
                    colSpan={10}
                    className="px-5 py-12 text-center"
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
                    colSpan={10}
                    className="px-5 py-12 text-center text-sm text-gray-400"
                  >

                    Belum ada Delivery Order
                    untuk outlet ini

                  </td>

                </tr>

              ) : (

                filteredData.flatMap(
                  (delivery) =>
                    delivery.items.map(
                      (item, index) => {

                        const harga =
                          getItemPrice(item);

                        const subtotal =
                          getItemSubtotal(item);

                        const totalDO =
                          getDeliveryTotal(
                            delivery
                          );

                        return (
                          <tr
                            key={`${delivery.id}-${item.id}`}
                            className="
                              border-b
                              border-[#EDF2EF]
                              hover:bg-[#FAFCFB]
                            "
                          >

                            {/* TANGGAL */}

                            <td className="px-5 py-4 align-top">

                              <div className="flex items-center gap-2 text-[#35564C]">

                                <CalendarDays
                                  size={15}
                                />

                                <span className="font-medium">
                                  {formatDate(
                                    delivery.deliveryDate
                                  )}
                                </span>

                              </div>

                            </td>

                            {/* DO */}

                            <td className="px-5 py-4 align-top">

                              <div className="font-semibold text-[#18352D]">
                                {delivery.number}
                              </div>

                              {index === 0 &&
                                delivery.remarks && (
                                  <div className="mt-1 max-w-[220px] text-xs text-gray-400">
                                    {delivery.remarks}
                                  </div>
                                )}

                            </td>

                            {/* SURAT JALAN */}

                            <td className="px-5 py-4 align-top">

                              <span className="text-[#35564C]">
                                {delivery.suratJalan
                                  ?.number || "-"}
                              </span>

                            </td>

                            {/* OUTLET */}

                            <td className="px-5 py-4 align-top">

                              <div className="font-semibold text-[#18352D]">
                                {delivery.outlet
                                  ?.name || "-"}
                              </div>

                              <div className="text-xs text-gray-400">
                                {delivery.outlet
                                  ?.code || "-"}
                              </div>

                            </td>

                            {/* BARANG */}

                            <td className="px-5 py-4 align-top">

                              <div className="font-semibold text-[#18352D]">
                                {item.barang?.name}
                              </div>

                              <div className="text-xs text-gray-400">
                                {item.barang?.code}
                              </div>

                            </td>

                            {/* QTY */}

                            <td className="px-5 py-4 text-center align-top">

                              <span className="inline-flex rounded-full bg-[#EAF3EF] px-3 py-1 text-xs font-semibold text-[#497F70]">

                                {formatNumber(
                                  item.qty
                                )}{" "}

                                {item.barang?.unit}

                              </span>

                            </td>

                            {/* HARGA */}

                            <td className="px-5 py-4 text-right align-top whitespace-nowrap">

                              <span className="font-medium text-[#35564C]">
                                {formatRupiah(
                                  harga
                                )}
                              </span>

                            </td>

                            {/* SUBTOTAL */}

                            <td className="px-5 py-4 text-right align-top whitespace-nowrap">

                              <span className="font-semibold text-[#18352D]">
                                {formatRupiah(
                                  subtotal
                                )}
                              </span>

                            </td>

                            {/* TOTAL DO */}

                            <td className="px-5 py-4 text-right align-top whitespace-nowrap">

                              {index === 0 ? (

                                <span className="font-bold text-[#18352D]">
                                  {formatRupiah(
                                    totalDO
                                  )}
                                </span>

                              ) : (

                                <span className="text-gray-300">
                                  —
                                </span>

                              )}

                            </td>

                            {/* STATUS */}

                            <td className="px-5 py-4 text-center align-top">

                              <span
                                className={`
                                  inline-flex
                                  rounded-full
                                  px-3
                                  py-1
                                  text-xs
                                  font-semibold
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
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}