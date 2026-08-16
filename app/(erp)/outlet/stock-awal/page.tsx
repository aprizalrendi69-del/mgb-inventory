"use client";

import { useEffect, useState } from "react";
import {
  Package,
  Plus,
  RefreshCw,
  Search,
  Warehouse,
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
  stock: number;
  purchasePrice: number;
  minimumStock: number;
};

type OutletStock = {
  id: number;
  stock: number;
  minimumStock: number;
  averageCost: number;
  outlet: Outlet;
  barang: Barang;
};

export default function StockAwalOutletPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [barang, setBarang] = useState<Barang[]>([]);
  const [stocks, setStocks] = useState<OutletStock[]>([]);

  const [outletId, setOutletId] = useState("");
  const [barangId, setBarangId] = useState("");

  const [qty, setQty] = useState("");
  const [averageCost, setAverageCost] =
    useState("");
  const [minimumStock, setMinimumStock] =
    useState("");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // =====================================================
  // LOAD OUTLET
  // =====================================================

  async function loadOutlets() {
    try {
      const res = await fetch(
        "/api/outlet",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      setOutlets(
        Array.isArray(json)
          ? json
          : json.data || []
      );
    } catch (error) {
      console.error(
        "LOAD OUTLET ERROR:",
        error
      );

      setOutlets([]);
    }
  }

  // =====================================================
  // LOAD BARANG
  // =====================================================

  async function loadBarang() {
    try {
      const res = await fetch(
        "/api/barang",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      setBarang(
        Array.isArray(json)
          ? json
          : json.data || []
      );
    } catch (error) {
      console.error(
        "LOAD BARANG ERROR:",
        error
      );

      setBarang([]);
    }
  }

  // =====================================================
  // LOAD STOCK
  // =====================================================

  async function loadStock(
    selectedOutlet = outletId
  ) {
    try {
      setLoading(true);

      const url = selectedOutlet
        ? `/api/outlet/stock-awal?outletId=${selectedOutlet}`
        : "/api/outlet/stock-awal";

      const res = await fetch(url, {
        cache: "no-store",
      });

      const json = await res.json();

      setStocks(
        Array.isArray(json.data)
          ? json.data
          : []
      );
    } catch (error) {
      console.error(
        "LOAD STOCK ERROR:",
        error
      );

      setStocks([]);
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // INITIAL
  // =====================================================

  useEffect(() => {
    loadOutlets();
    loadBarang();
    loadStock("");
  }, []);

  // =====================================================
  // PILIH BARANG
  // =====================================================

  function handleBarangChange(
    value: string
  ) {
    setBarangId(value);

    const selected = barang.find(
      (item) =>
        String(item.id) === value
    );

    if (selected) {
      setAverageCost(
        String(
          selected.purchasePrice ?? 0
        )
      );

      setMinimumStock(
        String(
          selected.minimumStock ?? 0
        )
      );
    }
  }

  // =====================================================
  // SIMPAN
  // =====================================================

  async function simpan() {
    if (!outletId) {
      alert("Pilih outlet terlebih dahulu");
      return;
    }

    if (!barangId) {
      alert("Pilih barang terlebih dahulu");
      return;
    }

    const jumlah = Number(qty);

    if (!Number.isFinite(jumlah) || jumlah < 0) {
      alert("Qty stock awal tidak valid");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(
        "/api/outlet/stock-awal",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            outletId: Number(outletId),
            barangId: Number(barangId),
            qty: jumlah,
            averageCost:
              Number(averageCost) || 0,
            minimumStock:
              Number(minimumStock) || 0,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        alert(
          json.message ||
            "Gagal menyimpan stock awal"
        );

        return;
      }

      alert(
        "Stock awal outlet berhasil disimpan"
      );

      setBarangId("");
      setQty("");
      setAverageCost("");
      setMinimumStock("");

      await loadStock(outletId);
    } catch (error) {
      console.error(
        "SIMPAN STOCK AWAL ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menyimpan stock awal"
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // FILTER
  // =====================================================

  const filteredStocks = stocks.filter(
    (item) => {
      const text =
        `${item.barang.code} ${item.barang.name}`
          .toLowerCase();

      return text.includes(
        search.toLowerCase()
      );
    }
  );

  // =====================================================
  // FORMAT
  // =====================================================

  function formatNumber(value: any) {
    return Number(
      value ?? 0
    ).toLocaleString("id-ID");
  }

  function formatRupiah(value: any) {
    return `Rp ${formatNumber(value)}`;
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
            <Warehouse size={23} />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Stock Awal Outlet
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Masukkan stok awal masing-masing outlet
            </p>
          </div>

        </div>

        <button
          type="button"
          onClick={() =>
            loadStock(outletId)
          }
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
          "
        >
          <RefreshCw size={16} />
          Refresh
        </button>

      </div>

      <div className="space-y-6">

        {/* FORM */}

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm md:p-6">

          <div className="mb-5 flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
              <Plus size={19} />
            </div>

            <div>
              <h2 className="font-semibold text-[#18352D]">
                Tambah Stock Awal
              </h2>

              <p className="text-xs text-gray-500">
                Stok awal tidak akan mengurangi stok gudang pusat
              </p>
            </div>

          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-5">

            {/* OUTLET */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#35564C]">
                Outlet
              </label>

              <select
                value={outletId}
                onChange={(e) => {
                  setOutletId(
                    e.target.value
                  );

                  loadStock(
                    e.target.value
                  );
                }}
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  px-4
                  py-3
                  text-sm
                  outline-none
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              >
                <option value="">
                  -- Semua Outlet --
                </option>

                {outlets.map((outlet) => (
                  <option
                    key={outlet.id}
                    value={outlet.id}
                  >
                    {outlet.code} -{" "}
                    {outlet.name}
                  </option>
                ))}
              </select>
            </div>

            {/* BARANG */}

            <div className="lg:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-[#35564C]">
                Barang
              </label>

              <select
                value={barangId}
                onChange={(e) =>
                  handleBarangChange(
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
                  outline-none
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              >
                <option value="">
                  -- Pilih Barang --
                </option>

                {barang.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.code} -{" "}
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            {/* QTY */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#35564C]">
                Qty Awal
              </label>

              <input
                type="number"
                min="0"
                value={qty}
                onChange={(e) =>
                  setQty(e.target.value)
                }
                placeholder="0"
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  px-4
                  py-3
                  text-sm
                  outline-none
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />
            </div>

            {/* HARGA */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#35564C]">
                Harga Modal
              </label>

              <input
                type="number"
                min="0"
                value={averageCost}
                onChange={(e) =>
                  setAverageCost(
                    e.target.value
                  )
                }
                placeholder="0"
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  px-4
                  py-3
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

          <div className="mt-5 flex justify-end">

            <button
              type="button"
              onClick={simpan}
              disabled={saving}
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-[#497F70]
                px-6
                py-3
                text-sm
                font-semibold
                text-white
                shadow-sm
                transition
                hover:bg-[#3D6D60]
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {saving ? (
                <>
                  <RefreshCw
                    size={17}
                    className="animate-spin"
                  />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Plus size={17} />
                  Simpan Stock Awal
                </>
              )}
            </button>

          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

          <div className="flex flex-col gap-4 border-b border-[#E5ECE9] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
                <Package size={19} />
              </div>

              <div>
                <h2 className="font-semibold text-[#18352D]">
                  Stock Outlet
                </h2>

                <p className="text-xs text-gray-500">
                  Daftar stok yang sudah dimasukkan
                </p>
              </div>

            </div>

            <div className="relative w-full md:w-72">

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
                placeholder="Cari barang..."
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

          <div className="overflow-x-auto">

            <table className="min-w-[800px] w-full text-sm">

              <thead className="bg-[#F5F8F6]">

                <tr className="border-b border-[#E5ECE9]">

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Outlet
                  </th>

                  <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                    Barang
                  </th>

                  <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                    Stock
                  </th>

                  <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                    Harga Modal
                  </th>

                  <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                    Nilai Stock
                  </th>

                </tr>

              </thead>

              <tbody>

                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-12 text-center"
                    >
                      <RefreshCw
                        size={20}
                        className="mx-auto mb-2 animate-spin text-[#497F70]"
                      />

                      <p className="text-sm text-gray-500">
                        Memuat stock...
                      </p>
                    </td>
                  </tr>
                ) : filteredStocks.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-12 text-center text-sm text-gray-400"
                    >
                      Belum ada stock outlet
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map(
                    (item) => (
                      <tr
                        key={item.id}
                        className="border-b border-[#EDF2EF] hover:bg-[#FAFCFB]"
                      >

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {item.outlet.name}
                          </div>

                          <div className="text-xs text-gray-400">
                            {item.outlet.code}
                          </div>

                        </td>

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {item.barang.name}
                          </div>

                          <div className="text-xs text-gray-400">
                            {item.barang.code}
                          </div>

                        </td>

                        <td className="px-5 py-4 text-center">

                          <span className="inline-flex rounded-full bg-[#EAF3EF] px-3 py-1 text-xs font-semibold text-[#497F70]">
                            {formatNumber(
                              item.stock
                            )}{" "}
                            {item.barang.unit}
                          </span>

                        </td>

                        <td className="px-5 py-4 text-right text-gray-600">
                          {formatRupiah(
                            item.averageCost
                          )}
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-[#18352D]">
                          {formatRupiah(
                            Number(
                              item.stock
                            ) *
                              Number(
                                item.averageCost
                              )
                          )}
                        </td>

                      </tr>
                    )
                  )
                )}

              </tbody>

            </table>

          </div>

        </div>

      </div>
    </div>
  );
}