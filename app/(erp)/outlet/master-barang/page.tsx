"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Upload,
  Search,
  RefreshCw,
  Package,
  X,
} from "lucide-react";

type Outlet = {
  id: number;
  code: string;
  name: string;
};

type Barang = {
  id: number;
  code: string;
  barcode: string | null;
  name: string;
  category: string | null;
  brand: string | null;
  unit: string;
};

type OutletBarang = {
  id: number;
  harga: number | null;
  aktif: boolean;
  outlet: Outlet;
  barang: Barang;
};

type User = {
  role: string;
  outletId: number | null;
};

export default function OutletMasterBarangPage() {
  const [data, setData] = useState<OutletBarang[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [user, setUser] = useState<User | null>(null);

  const [search, setSearch] = useState("");
  const [outletId, setOutletId] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    outletId: "",
    code: "",
    barcode: "",
    name: "",
    category: "",
    brand: "",
    unit: "",
    harga: "",
    minimumStock: "",
  });

  useEffect(() => {
    loadUser();
    loadOutlets();
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [search, outletId, user]);

  async function loadUser() {
    try {
      const res = await fetch("/api/me", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json?.user) {
        setUser(json.user);

        if (
          json.user.role === "OUTLET_ADMIN" &&
          json.user.outletId
        ) {
          const id = String(json.user.outletId);

          setOutletId(id);

          setForm((prev) => ({
            ...prev,
            outletId: id,
          }));
        }
      }
    } catch (error) {
      console.error("Gagal mengambil user:", error);
    }
  }

  async function loadOutlets() {
    try {
      const res = await fetch("/api/outlet", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setOutlets(json.data || []);
      }
    } catch (error) {
      console.error("Gagal mengambil outlet:", error);
    }
  }

  async function loadData() {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (outletId) {
        params.set("outletId", outletId);
      }

      const res = await fetch(
        `/api/outlet/master-barang?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (json.success) {
        setData(json.data || []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error(
        "Gagal mengambil master barang:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    const selectedOutlet =
      user?.role === "OUTLET_ADMIN" && user.outletId
        ? String(user.outletId)
        : outletId || "";

    setForm({
      outletId: selectedOutlet,
      code: "",
      barcode: "",
      name: "",
      category: "",
      brand: "",
      unit: "",
      harga: "",
      minimumStock: "",
    });
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    const selectedOutlet =
      user?.role === "OUTLET_ADMIN"
        ? user.outletId
        : form.outletId;

    if (!selectedOutlet) {
      alert("Pilih outlet terlebih dahulu");
      return;
    }

    if (!form.code.trim()) {
      alert("Kode barang wajib diisi");
      return;
    }

    if (!form.name.trim()) {
      alert("Nama barang wajib diisi");
      return;
    }

    if (!form.unit.trim()) {
      alert("Satuan wajib diisi");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        outletId: String(selectedOutlet),
        code: form.code.trim(),
        barcode: form.barcode.trim(),
        name: form.name.trim(),
        category: form.category.trim(),
        brand: form.brand.trim(),
        unit: form.unit.trim(),
        harga: Number(form.harga) || 0,
        minimumStock:
          Number(form.minimumStock) || 0,
      };

      const res = await fetch(
        "/api/outlet/master-barang",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        alert(
          json.message ||
            "Gagal menambahkan barang"
        );
        return;
      }

      alert(
        json.message ||
          "Barang outlet berhasil ditambahkan"
      );

      setShowForm(false);
      resetForm();

      await loadData();
    } catch (error) {
      console.error(
        "Gagal menyimpan barang:",
        error
      );

      alert(
        "Terjadi kesalahan saat menyimpan barang"
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // IMPORT EXCEL
  // =========================================================

  async function handleImport(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    const selectedOutlet =
      user?.role === "OUTLET_ADMIN"
        ? user.outletId
        : form.outletId || outletId;

    if (!selectedOutlet) {
      alert("Pilih outlet terlebih dahulu");
      e.target.value = "";
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();

      formData.append("file", file);
      formData.append(
        "outletId",
        String(selectedOutlet)
      );

      const res = await fetch(
        "/api/outlet/master-barang/import",
        {
          method: "POST",
          body: formData,
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        alert(
          json.message ||
            "Import barang outlet gagal"
        );
        return;
      }

      const summary = json.summary || {};

      alert(
        json.message ||
          `Import selesai.\n\n` +
            `Total: ${summary.total || 0}\n` +
            `Berhasil: ${summary.berhasil || 0}\n` +
            `Dilewati: ${summary.dilewati || 0}\n` +
            `Gagal: ${summary.gagal || 0}`
      );

      await loadData();
    } catch (error) {
      console.error(
        "IMPORT BARANG OUTLET ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat import Excel"
      );
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="p-6">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div>
          <h1 className="text-2xl font-bold text-[#29483A]">
            Master Barang Outlet
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Kelola barang yang tersedia pada masing-masing outlet
          </p>
        </div>

        <div className="flex gap-2">

          {/* IMPORT EXCEL */}

          <label
            className="
              flex
              cursor-pointer
              items-center
              gap-2
              rounded-xl
              bg-[#527A6B]
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              hover:bg-[#42685A]
              disabled:cursor-not-allowed
            "
          >
            <Upload size={17} />

            {loading
              ? "Mengimport..."
              : "Import Excel"}

            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={loading}
              onChange={handleImport}
            />
          </label>

          {/* TAMBAH BARANG */}

          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="
              flex
              items-center
              gap-2
              rounded-xl
              bg-[#29483A]
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              hover:bg-[#1F382D]
            "
          >
            <Plus size={17} />

            Tambah Barang
          </button>

        </div>
      </div>

      {/* =====================================================
          INFO IMPORT
      ===================================================== */}

      <div className="mb-5 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800">

        <div className="font-semibold">
          Format Excel Import
        </div>

        <div className="mt-1">
          Kolom wajib: <b>Kode Barang</b>
        </div>

        <div>
          Kolom harga: <b>Harga</b> (opsional)
        </div>

        <div className="mt-1 text-xs text-green-700">
          Barang harus sudah terdaftar di Master
          Barang Central.
        </div>

      </div>

      {/* =====================================================
          FILTER
      ===================================================== */}

      <div
        className="
          mb-5
          rounded-2xl
          border
          border-gray-200
          bg-white
          p-4
          shadow-sm
        "
      >
        <div className="flex flex-col gap-3 md:flex-row">

          {/* FILTER OUTLET */}

          {user?.role !== "OUTLET_ADMIN" && (
            <select
              value={outletId}
              onChange={(e) => {
                setOutletId(e.target.value);

                setForm((prev) => ({
                  ...prev,
                  outletId: e.target.value,
                }));
              }}
              className="
                rounded-xl
                border
                border-gray-300
                px-4
                py-2.5
                text-sm
                outline-none
                focus:border-[#527A6B]
              "
            >
              <option value="">
                Semua Outlet
              </option>

              {outlets.map((outlet) => (
                <option
                  key={outlet.id}
                  value={outlet.id}
                >
                  {outlet.code} - {outlet.name}
                </option>
              ))}
            </select>
          )}

          {/* SEARCH */}

          <div className="relative flex-1">

            <Search
              size={18}
              className="
                absolute
                left-3
                top-1/2
                -translate-y-1/2
                text-gray-400
              "
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Cari kode, barcode atau nama barang..."
              className="
                w-full
                rounded-xl
                border
                border-gray-300
                py-2.5
                pl-10
                pr-4
                text-sm
                outline-none
                focus:border-[#527A6B]
              "
            />

          </div>

          {/* REFRESH */}

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="
              flex
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              border-gray-300
              px-4
              py-2.5
              text-sm
              font-semibold
              text-gray-700
              hover:bg-gray-50
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
      </div>

      {/* =====================================================
          TABLE
      ===================================================== */}

      <div
        className="
          overflow-hidden
          rounded-2xl
          border
          border-gray-200
          bg-white
          shadow-sm
        "
      >
        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead className="bg-[#EEF5F1]">

              <tr>

                <th className="px-4 py-3 text-left">
                  No
                </th>

                <th className="px-4 py-3 text-left">
                  Outlet
                </th>

                <th className="px-4 py-3 text-left">
                  Kode
                </th>

                <th className="px-4 py-3 text-left">
                  Barcode
                </th>

                <th className="px-4 py-3 text-left">
                  Nama Barang
                </th>

                <th className="px-4 py-3 text-left">
                  Kategori
                </th>

                <th className="px-4 py-3 text-left">
                  Satuan
                </th>

                <th className="px-4 py-3 text-right">
                  Harga
                </th>

                <th className="px-4 py-3 text-center">
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-10 text-center text-gray-500"
                  >
                    <RefreshCw
                      size={22}
                      className="mx-auto mb-2 animate-spin"
                    />

                    Memuat data...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-14 text-center"
                  >
                    <Package
                      size={35}
                      className="mx-auto mb-2 text-gray-300"
                    />

                    <p className="font-semibold text-gray-500">
                      Belum ada master barang outlet
                    </p>
                  </td>
                </tr>
              ) : (
                data.map((item, index) => (
                  <tr
                    key={item.id}
                    className="
                      border-t
                      border-gray-100
                      hover:bg-gray-50
                    "
                  >

                    <td className="px-4 py-3">
                      {index + 1}
                    </td>

                    <td className="px-4 py-3 font-semibold">
                      {item.outlet.code}
                    </td>

                    <td className="px-4 py-3 font-medium">
                      {item.barang.code}
                    </td>

                    <td className="px-4 py-3 text-gray-500">
                      {item.barang.barcode || "-"}
                    </td>

                    <td className="px-4 py-3 font-semibold">
                      {item.barang.name}
                    </td>

                    <td className="px-4 py-3">
                      {item.barang.category || "-"}
                    </td>

                    <td className="px-4 py-3">
                      {item.barang.unit}
                    </td>

                    <td className="px-4 py-3 text-right">
                      Rp{" "}
                      {Number(
                        item.harga || 0
                      ).toLocaleString("id-ID")}
                    </td>

                    <td className="px-4 py-3 text-center">

                      <span
                        className={`
                          rounded-full
                          px-3
                          py-1
                          text-xs
                          font-semibold
                          ${
                            item.aktif
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }
                        `}
                      >
                        {item.aktif
                          ? "Aktif"
                          : "Nonaktif"}
                      </span>

                    </td>

                  </tr>
                ))
              )}

            </tbody>

          </table>

        </div>
      </div>

      {/* =====================================================
          FORM TAMBAH BARANG
      ===================================================== */}

      {showForm && (
        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-black/40
            p-4
          "
        >

          <div
            className="
              w-full
              max-w-2xl
              rounded-2xl
              bg-white
              shadow-xl
            "
          >

            {/* FORM HEADER */}

            <div
              className="
                flex
                items-center
                justify-between
                border-b
                px-6
                py-4
              "
            >

              <div>

                <h2 className="text-lg font-bold text-[#29483A]">
                  Tambah Master Barang Outlet
                </h2>

                <p className="text-xs text-gray-500">
                  Tambahkan barang dari Master Barang Central
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowForm(false)
                }
                className="
                  rounded-lg
                  p-2
                  hover:bg-gray-100
                "
              >
                <X size={19} />
              </button>

            </div>

            {/* FORM */}

            <form
              onSubmit={handleSubmit}
              className="space-y-4 p-6"
            >

              {/* OUTLET */}

              {user?.role !== "OUTLET_ADMIN" && (
                <div>

                  <label className="mb-1 block text-sm font-semibold">
                    Outlet
                  </label>

                  <select
                    required
                    value={form.outletId}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        outletId:
                          e.target.value,
                      })
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-300
                      px-4
                      py-2.5
                    "
                  >

                    <option value="">
                      Pilih Outlet
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
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                {/* KODE */}

                <div>

                  <label className="mb-1 block text-sm font-semibold">
                    Kode Barang *
                  </label>

                  <input
                    required
                    value={form.code}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        code: e.target.value,
                      })
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-300
                      px-4
                      py-2.5
                    "
                    placeholder="Kode Barang Central"
                  />

                </div>

                {/* BARCODE */}

                <div>

                  <label className="mb-1 block text-sm font-semibold">
                    Barcode
                  </label>

                  <input
                    value={form.barcode}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        barcode: e.target.value,
                      })
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-300
                      px-4
                      py-2.5
                    "
                  />

                </div>

                {/* NAMA */}

                <div className="md:col-span-2">

                  <label className="mb-1 block text-sm font-semibold">
                    Nama Barang *
                  </label>

                  <input
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        name: e.target.value,
                      })
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-300
                      px-4
                      py-2.5
                    "
                  />

                </div>

                {/* KATEGORI */}

                <div>

                  <label className="mb-1 block text-sm font-semibold">
                    Kategori
                  </label>

                  <input
                    value={form.category}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        category:
                          e.target.value,
                      })
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-300
                      px-4
                      py-2.5
                    "
                  />

                </div>

                {/* BRAND */}

                <div>

                  <label className="mb-1 block text-sm font-semibold">
                    Brand
                  </label>

                  <input
                    value={form.brand}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        brand: e.target.value,
                      })
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-300
                      px-4
                      py-2.5
                    "
                  />

                </div>

                {/* SATUAN */}

                <div>

                  <label className="mb-1 block text-sm font-semibold">
                    Satuan *
                  </label>

                  <input
                    required
                    value={form.unit}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        unit: e.target.value,
                      })
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-300
                      px-4
                      py-2.5
                    "
                    placeholder="PCS / BOX / KG"
                  />

                </div>

                {/* HARGA */}

                <div>

                  <label className="mb-1 block text-sm font-semibold">
                    Harga
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={form.harga}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        harga: e.target.value,
                      })
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-300
                      px-4
                      py-2.5
                    "
                  />

                </div>

                {/* MINIMUM STOCK */}

                <div>

                  <label className="mb-1 block text-sm font-semibold">
                    Minimum Stock
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={form.minimumStock}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        minimumStock:
                          e.target.value,
                      })
                    }
                    className="
                      w-full
                      rounded-xl
                      border
                      border-gray-300
                      px-4
                      py-2.5
                    "
                  />

                </div>

              </div>

              {/* BUTTON */}

              <div className="flex justify-end gap-2 pt-3">

                <button
                  type="button"
                  onClick={() =>
                    setShowForm(false)
                  }
                  className="
                    rounded-xl
                    border
                    px-5
                    py-2.5
                    text-sm
                    font-semibold
                  "
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="
                    rounded-xl
                    bg-[#29483A]
                    px-5
                    py-2.5
                    text-sm
                    font-semibold
                    text-white
                    disabled:opacity-50
                  "
                >
                  {saving
                    ? "Menyimpan..."
                    : "Simpan"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}