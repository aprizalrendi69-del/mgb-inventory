"use client";

import { useEffect, useMemo, useState } from "react";

import BarangForm from "@/components/master/barang/BarangForm";
import BarangTable from "@/components/master/barang/BarangTable";
import SearchBar from "@/components/master/barang/SearchBar";
import ImportBarangModal from "@/components/master/barang/ImportBarangModal";

export default function BarangPage() {
  const [barang, setBarang] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [openImport, setOpenImport] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadBarang() {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/master/barang?search=${encodeURIComponent(search)}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (json.success) {
        setBarang(json.data ?? []);
      } else {
        setBarang([]);
      }
    } catch (error) {
      console.error("Load barang error:", error);
      setBarang([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBarang();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadBarang();
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  /*
   * ============================
   * SUMMARY
   * ============================
   */

  const totalBarang = barang.length;

  const totalStok = useMemo(() => {
    return barang.reduce(
      (total, item) => total + Number(item.stock ?? 0),
      0
    );
  }, [barang]);

  const stokMenipis = useMemo(() => {
    return barang.filter((item) => {
      const stock = Number(item.stock ?? 0);
      const minimum = Number(
        item.minimumStock ??
        item.minStock ??
        0
      );

      return minimum > 0 && stock <= minimum;
    }).length;
  }, [barang]);

  const expired = useMemo(() => {
    return barang.filter((item) => {
      if (!item.expiredDate) return false;

      return new Date(item.expiredDate) < new Date();
    }).length;
  }, [barang]);

  return (
    <div className="min-h-full space-y-6">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">
            Master Barang
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Kelola data barang, kategori, satuan, harga,
            stok dan informasi expired.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">

          <button
            type="button"
            onClick={() => setOpenImport(true)}
            className="
              inline-flex
              items-center
              gap-2
              rounded-xl
              border
              border-emerald-200
              bg-emerald-50
              px-5
              py-2.5
              text-sm
              font-semibold
              text-emerald-700
              transition
              hover:bg-emerald-100
            "
          >
            <span className="text-base">
              ↑
            </span>

            Import Excel
          </button>

        </div>
      </div>


      {/* =====================================================
          SUMMARY CARDS
      ===================================================== */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* TOTAL BARANG */}

        <div className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-5
          shadow-sm
        ">

          <div className="flex items-start justify-between">

            <div>
              <p className="text-sm font-medium text-slate-500">
                Total Barang
              </p>

              <p className="mt-2 text-3xl font-bold text-slate-800">
                {totalBarang.toLocaleString("id-ID")}
              </p>
            </div>

            <div className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-blue-50
              text-xl
            ">
              📦
            </div>

          </div>

          <p className="mt-3 text-xs text-slate-400">
            Data barang yang ditampilkan
          </p>

        </div>


        {/* TOTAL STOCK */}

        <div className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-5
          shadow-sm
        ">

          <div className="flex items-start justify-between">

            <div>
              <p className="text-sm font-medium text-slate-500">
                Total Stock
              </p>

              <p className="mt-2 text-3xl font-bold text-slate-800">
                {totalStok.toLocaleString("id-ID")}
              </p>
            </div>

            <div className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-emerald-50
              text-xl
            ">
              📊
            </div>

          </div>

          <p className="mt-3 text-xs text-slate-400">
            Total quantity seluruh barang
          </p>

        </div>


        {/* STOCK MENIPIS */}

        <div className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-5
          shadow-sm
        ">

          <div className="flex items-start justify-between">

            <div>
              <p className="text-sm font-medium text-slate-500">
                Stock Menipis
              </p>

              <p className="mt-2 text-3xl font-bold text-amber-600">
                {stokMenipis.toLocaleString("id-ID")}
              </p>
            </div>

            <div className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-amber-50
              text-xl
            ">
              ⚠️
            </div>

          </div>

          <p className="mt-3 text-xs text-slate-400">
            Barang di bawah batas minimum
          </p>

        </div>


        {/* EXPIRED */}

        <div className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-5
          shadow-sm
        ">

          <div className="flex items-start justify-between">

            <div>
              <p className="text-sm font-medium text-slate-500">
                Expired
              </p>

              <p className="mt-2 text-3xl font-bold text-red-600">
                {expired.toLocaleString("id-ID")}
              </p>
            </div>

            <div className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-red-50
              text-xl
            ">
              ⏰
            </div>

          </div>

          <p className="mt-3 text-xs text-slate-400">
            Barang yang sudah expired
          </p>

        </div>

      </div>


      {/* =====================================================
          FORM TAMBAH BARANG — PREMIUM
      ===================================================== */}

      <section className="
        relative
        overflow-hidden
        rounded-[24px]
        border
        border-slate-200/80
        bg-white
        shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)]
      ">

        {/* Premium top accent */}
        <div className="
          absolute
          inset-x-0
          top-0
          h-1
          bg-gradient-to-r
          from-emerald-500
          via-teal-500
          to-blue-500
        " />

        {/* Header */}
        <div className="
          relative
          border-b
          border-slate-100
          bg-gradient-to-br
          from-slate-50
          via-white
          to-emerald-50/40
          px-5
          py-5
          sm:px-6
          sm:py-6
        ">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex min-w-0 items-center gap-4">

              <div className="
                flex
                h-12
                w-12
                shrink-0
                items-center
                justify-center
                rounded-2xl
                bg-gradient-to-br
                from-emerald-500
                to-teal-600
                text-white
                shadow-lg
                shadow-emerald-500/20
              ">
                <span className="text-xl font-bold">+</span>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold tracking-tight text-slate-800 sm:text-xl">
                    Tambah Barang
                  </h2>

                  <span className="
                    inline-flex
                    items-center
                    rounded-full
                    border
                    border-emerald-200
                    bg-emerald-50
                    px-2.5
                    py-1
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-[0.12em]
                    text-emerald-700
                  ">
                    Master Data
                  </span>
                </div>

                <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                  Tambahkan barang baru dengan data yang lengkap dan siap digunakan dalam transaksi.
                </p>
              </div>

            </div>

            <div className="
              hidden
              rounded-2xl
              border
              border-slate-200/80
              bg-white/80
              px-4
              py-2.5
              shadow-sm
              sm:block
            ">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Data Entry
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-600">
                Lengkapi informasi barang
              </p>
            </div>

          </div>

        </div>

        {/* Form body */}
        <div className="
          relative
          bg-white
          px-4
          py-5
          sm:px-6
          sm:py-6
        ">

          <div className="
            rounded-2xl
            border
            border-slate-100
            bg-slate-50/50
            p-3
            sm:p-5
          ">

            <BarangForm
              reload={loadBarang}
            />

          </div>

        </div>

        {/* Bottom helper */}
        <div className="
          flex
          items-center
          gap-2
          border-t
          border-slate-100
          bg-slate-50/70
          px-5
          py-3
          text-[11px]
          text-slate-500
          sm:px-6
        ">
          <span className="
            flex
            h-5
            w-5
            shrink-0
            items-center
            justify-center
            rounded-full
            bg-emerald-100
            text-[10px]
            font-bold
            text-emerald-700
          ">
            ✓
          </span>
          Pastikan satuan, kategori, harga, stok minimum, dan informasi lainnya sudah sesuai sebelum menyimpan.
        </div>

      </section>


      {/* =====================================================
          DATA BARANG
      ===================================================== */}

      <div className="
        overflow-hidden
        rounded-2xl
        border
        border-slate-200
        bg-white
        shadow-sm
      ">

        {/* TOOLBAR */}

        <div className="
          flex
          flex-col
          gap-4
          border-b
          border-slate-100
          p-5
          lg:flex-row
          lg:items-center
          lg:justify-between
        ">

          <div>

            <h2 className="text-lg font-semibold text-slate-800">
              Daftar Barang
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {loading
                ? "Memuat data..."
                : `${barang.length.toLocaleString("id-ID")} barang ditemukan`}
            </p>

          </div>

          <div className="w-full lg:w-[420px]">

            <SearchBar
              search={search}
              setSearch={setSearch}
            />

          </div>

        </div>


        {/* TABLE */}

        <div className="relative">

          {loading ? (

            <div className="
              flex
              min-h-[300px]
              items-center
              justify-center
              px-6
            ">

              <div className="text-center">

                <div className="
                  mx-auto
                  h-9
                  w-9
                  animate-spin
                  rounded-full
                  border-4
                  border-slate-200
                  border-t-blue-600
                " />

                <p className="mt-3 text-sm text-slate-500">
                  Memuat data barang...
                </p>

              </div>

            </div>

          ) : barang.length === 0 ? (

            <div className="
              flex
              min-h-[300px]
              items-center
              justify-center
              px-6
            ">

              <div className="text-center">

                <div className="text-5xl">
                  📦
                </div>

                <h3 className="
                  mt-4
                  font-semibold
                  text-slate-700
                ">
                  Data barang tidak ditemukan
                </h3>

                <p className="
                  mt-1
                  text-sm
                  text-slate-400
                ">
                  Coba gunakan kata pencarian lain.
                </p>

              </div>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <BarangTable
                data={barang}
                reload={loadBarang}
              />

            </div>

          )}

        </div>

      </div>


      {/* =====================================================
          IMPORT MODAL
      ===================================================== */}

      <ImportBarangModal
        open={openImport}
        onClose={() => setOpenImport(false)}
        reload={loadBarang}
      />

    </div>
  );
}