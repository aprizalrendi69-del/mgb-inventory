"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Search,
  RefreshCw,
  ClipboardCheck,
  Package,
  Save,
  AlertTriangle,
  CheckCircle2,
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

type OutletStock = {
  id: number;
  outletId: number;
  barangId: number;
  stock: number;
  minimumStock: number;
  averageCost: number;
  barang: Barang;
};

type CountItem = OutletStock & {
  physicalQty: number;
  note: string;
};

export default function OutletStockOpnamePage() {
  const [data, setData] = useState<CountItem[]>([]);
  const [outlet, setOutlet] =
    useState<Outlet | null>(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // =====================================================
  // LOAD
  // =====================================================

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch(
        "/api/outlet/stock-opname",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal mengambil stock opname"
        );
      }

      setOutlet(json.outlet || null);

      const stocks: OutletStock[] =
        Array.isArray(json.data)
          ? json.data
          : [];

      setData(
        stocks.map((item) => ({
          ...item,
          physicalQty: Number(
            item.stock || 0
          ),
          note: "",
        }))
      );
    } catch (error: any) {
      console.error(
        "LOAD OUTLET STOCK OPNAME ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal mengambil stock opname"
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
  // FILTER
  // =====================================================

  const filteredData = useMemo(() => {
    const keyword =
      search.toLowerCase().trim();

    if (!keyword) {
      return data;
    }

    return data.filter((item) => {
      const text = [
        item.barang?.code,
        item.barang?.name,
        item.barang?.unit,
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(keyword);
    });
  }, [data, search]);

  // =====================================================
  // UPDATE PHYSICAL
  // =====================================================

  function updatePhysicalQty(
    stockId: number,
    value: string
  ) {
    const qty =
      value === ""
        ? 0
        : Number(value);

    setData((current) =>
      current.map((item) =>
        item.id === stockId
          ? {
              ...item,
              physicalQty:
                Number.isFinite(qty) &&
                qty >= 0
                  ? qty
                  : 0,
            }
          : item
      )
    );
  }

  // =====================================================
  // UPDATE NOTE
  // =====================================================

  function updateNote(
    stockId: number,
    value: string
  ) {
    setData((current) =>
      current.map((item) =>
        item.id === stockId
          ? {
              ...item,
              note: value,
            }
          : item
      )
    );
  }

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

  // =====================================================
  // DIFFERENCE
  // =====================================================

  function getDifference(
    item: CountItem
  ) {
    return (
      Number(item.physicalQty || 0) -
      Number(item.stock || 0)
    );
  }

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalBarang = data.length;

  const totalSystemQty = data.reduce(
    (sum, item) =>
      sum + Number(item.stock || 0),
    0
  );

  const totalPhysicalQty = data.reduce(
    (sum, item) =>
      sum + Number(item.physicalQty || 0),
    0
  );

  const totalDifference = data.reduce(
    (sum, item) =>
      sum + getDifference(item),
    0
  );

  const totalSelisihBarang = data.filter(
    (item) =>
      getDifference(item) !== 0
  ).length;

  // =====================================================
  // SAVE
  // =====================================================

  async function handleSave() {
    if (data.length === 0) {
      alert("Tidak ada barang untuk dihitung");
      return;
    }

    const confirmed = window.confirm(
      "Simpan Stock Opname untuk outlet ini?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(
        "/api/outlet/stock-opname",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            items: data.map((item) => ({
              stockId: item.id,
              physicalQty:
                Number(item.physicalQty || 0),
              note: item.note || null,
            })),
          }),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ||
            "Gagal menyimpan stock opname"
        );
      }

      alert(
        "Stock Opname berhasil disimpan"
      );

      await loadData();
    } catch (error: any) {
      console.error(
        "SAVE OUTLET STOCK OPNAME ERROR:",
        error
      );

      alert(
        error?.message ||
          "Gagal menyimpan stock opname"
      );
    } finally {
      setSaving(false);
    }
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
            <ClipboardCheck size={23} />
          </div>

          <div>

            <h1 className="text-2xl font-bold tracking-tight text-[#18352D] md:text-3xl">
              Stock Opname Outlet
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Pemeriksaan stock fisik outlet
            </p>

            {outlet && (
              <p className="mt-1 text-xs font-semibold text-[#497F70]">
                Outlet: {outlet.code} -{" "}
                {outlet.name}
              </p>
            )}

          </div>

        </div>

        <div className="flex gap-2">

          <button
            type="button"
            onClick={loadData}
            disabled={loading || saving}
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

          <button
            type="button"
            onClick={handleSave}
            disabled={
              loading ||
              saving ||
              data.length === 0
            }
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-[#497F70]
              px-5
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-sm
              hover:bg-[#3F7063]
              disabled:opacity-50
            "
          >
            {saving ? (
              <RefreshCw
                size={16}
                className="animate-spin"
              />
            ) : (
              <Save size={16} />
            )}

            Simpan Opname
          </button>

        </div>

      </div>

      {/* SUMMARY */}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Total Barang
          </p>

          <p className="mt-2 text-2xl font-bold text-[#18352D]">
            {formatNumber(totalBarang)}
          </p>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Stock Sistem
          </p>

          <p className="mt-2 text-2xl font-bold text-[#18352D]">
            {formatNumber(totalSystemQty)}
          </p>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Stock Fisik
          </p>

          <p className="mt-2 text-2xl font-bold text-[#18352D]">
            {formatNumber(totalPhysicalQty)}
          </p>
        </div>

        <div className="rounded-2xl border border-[#DDE9E4] bg-white p-5 shadow-sm">

          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Total Selisih
          </p>

          <p
            className={`mt-2 text-2xl font-bold ${
              totalDifference === 0
                ? "text-[#2F7A4F]"
                : "text-[#C84B4B]"
            }`}
          >
            {totalDifference > 0
              ? "+"
              : ""}
            {formatNumber(totalDifference)}
          </p>

          <p className="mt-1 text-[11px] text-gray-400">
            {totalSelisihBarang} barang berbeda
          </p>

        </div>

      </div>

      {/* TABLE */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        <div className="flex flex-col gap-4 border-b border-[#E5ECE9] px-5 py-4 md:flex-row md:items-center md:justify-between">

          <div>
            <h2 className="font-semibold text-[#18352D]">
              Daftar Barang
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Isi jumlah fisik berdasarkan hasil
              perhitungan di outlet
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
              placeholder="Cari kode atau nama barang..."
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

          <table className="min-w-[1200px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

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
                  Stock Sistem
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Stock Fisik
                </th>

                <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                  Selisih
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Catatan
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
                    colSpan={8}
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

              ) : filteredData.length === 0 ? (

                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-sm text-gray-400"
                  >
                    Belum ada stock barang
                    untuk outlet ini
                  </td>
                </tr>

              ) : (

                filteredData.map((item) => {

                  const difference =
                    getDifference(item);

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-[#EDF2EF] hover:bg-[#FAFCFB]"
                    >

                      <td className="px-5 py-4 align-top">
                        <span className="font-semibold text-[#35564C]">
                          {item.barang.code}
                        </span>
                      </td>

                      <td className="px-5 py-4 align-top">

                        <div className="font-semibold text-[#18352D]">
                          {item.barang.name}
                        </div>

                      </td>

                      <td className="px-5 py-4 text-center align-top">
                        {item.barang.unit}
                      </td>

                      <td className="px-5 py-4 text-right align-top">

                        <span className="font-semibold text-gray-600">
                          {formatNumber(
                            item.stock
                          )}
                        </span>

                      </td>

                      <td className="px-5 py-4 text-right align-top">

                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={
                            item.physicalQty
                          }
                          onChange={(e) =>
                            updatePhysicalQty(
                              item.id,
                              e.target.value
                            )
                          }
                          className="
                            w-28
                            rounded-lg
                            border
                            border-[#CFE0D7]
                            bg-white
                            px-3
                            py-2
                            text-right
                            font-semibold
                            text-[#18352D]
                            outline-none
                            focus:border-[#497F70]
                            focus:ring-2
                            focus:ring-[#497F70]/10
                          "
                        />

                      </td>

                      <td className="px-5 py-4 text-right align-top">

                        <span
                          className={`font-bold ${
                            difference > 0
                              ? "text-[#2F7A4F]"
                              : difference < 0
                              ? "text-[#C84B4B]"
                              : "text-gray-400"
                          }`}
                        >
                          {difference > 0
                            ? "+"
                            : ""}
                          {formatNumber(
                            difference
                          )}
                        </span>

                      </td>

                      <td className="px-5 py-4 align-top">

                        <input
                          value={item.note}
                          onChange={(e) =>
                            updateNote(
                              item.id,
                              e.target.value
                            )
                          }
                          placeholder="Catatan..."
                          className="
                            w-48
                            rounded-lg
                            border
                            border-[#D5E5DC]
                            bg-white
                            px-3
                            py-2
                            text-sm
                            outline-none
                            focus:border-[#497F70]
                          "
                        />

                      </td>

                      <td className="px-5 py-4 text-center align-top">

                        {difference === 0 ? (

                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F4EC] px-3 py-1 text-xs font-semibold text-[#2F7A4F]">
                            <CheckCircle2
                              size={13}
                            />
                            Sesuai
                          </span>

                        ) : (

                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF4DD] px-3 py-1 text-xs font-semibold text-[#9A6A18]">
                            <AlertTriangle
                              size={13}
                            />
                            Selisih
                          </span>

                        )}

                      </td>

                    </tr>
                  );
                })

              )}

            </tbody>

          </table>

        </div>

        {!loading &&
          filteredData.length > 0 && (
            <div className="border-t border-[#E5ECE9] bg-[#FAFCFB] px-5 py-4">

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                <p className="text-xs text-gray-500">
                  Menampilkan{" "}
                  <span className="font-semibold text-[#35564C]">
                    {formatNumber(
                      filteredData.length
                    )}
                  </span>{" "}
                  barang
                </p>

                <div className="flex gap-6">

                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase text-gray-400">
                      Sistem
                    </p>
                    <p className="font-bold text-[#18352D]">
                      {formatNumber(
                        totalSystemQty
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase text-gray-400">
                      Fisik
                    </p>
                    <p className="font-bold text-[#18352D]">
                      {formatNumber(
                        totalPhysicalQty
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase text-gray-400">
                      Selisih
                    </p>
                    <p className="font-bold text-[#18352D]">
                      {formatNumber(
                        totalDifference
                      )}
                    </p>
                  </div>

                </div>

              </div>

            </div>
          )}

      </div>

    </div>
  );
}