"use client";

import { useEffect, useState } from "react";
import {
  Package,
  Upload,
  Plus,
  Search,
  Boxes,
  RefreshCw,
  Warehouse,
  Store,
} from "lucide-react";

import BarangForm from "@/components/master/barang/BarangForm";
import BarangTable from "@/components/master/barang/BarangTable";
import SearchBar from "@/components/master/barang/SearchBar";
import ImportBarangModal from "@/components/master/barang/ImportBarangModal";

export default function BarangPage() {
  const [barang, setBarang] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("CENTRAL");
  const [openImport, setOpenImport] = useState(false);
  const [loading, setLoading] = useState(false);

  // ==========================================
  // LOAD BARANG
  // ==========================================

  async function loadBarang() {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      params.set("search", search);
      params.set("source", source);

      const res = await fetch(
        `/api/master/barang?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      console.log("MASTER BARANG:", json);

      if (json.success) {
        setBarang(json.data ?? []);
      } else {
        setBarang([]);
      }
    } catch (error) {
      console.error("LOAD BARANG ERROR:", error);
      setBarang([]);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // LOAD SAAT SEARCH / FILTER BERUBAH
  // ==========================================

  useEffect(() => {
    loadBarang();
  }, [search, source]);

  // ==========================================
  // LABEL FILTER
  // ==========================================

  const sourceLabel =
    source === "CENTRAL"
      ? "Barang Pusat"
      : source === "OUTLET"
      ? "Barang Outlet"
      : "Semua Barang";

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* ======================================
          HEADER
      ====================================== */}

      <div
        className="
          mb-7
          flex
          flex-col
          gap-4
          md:flex-row
          md:items-center
          md:justify-between
        "
      >

        {/* TITLE */}

        <div className="flex items-center gap-3">

          <div
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-xl
              bg-[#EAF3EF]
              text-[#497F70]
              shadow-sm
            "
          >
            <Package size={23} />
          </div>

          <div>

            <h1
              className="
                text-2xl
                font-bold
                tracking-tight
                text-[#18352D]
                md:text-3xl
              "
            >
              Master Barang
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Kelola data barang inventory perusahaan
            </p>

          </div>

        </div>

        {/* ACTION */}

        <div className="flex flex-wrap items-center gap-2">

          {/* TOTAL */}

          <div
            className="
              hidden
              items-center
              gap-2
              rounded-xl
              border
              border-[#D5E5DC]
              bg-white
              px-4
              py-2.5
              text-sm
              text-gray-500
              shadow-sm
              sm:flex
            "
          >
            <Boxes
              size={17}
              className="text-[#497F70]"
            />

            <span>
              {barang.length} jenis barang
            </span>
          </div>

          {/* REFRESH */}

          <button
            type="button"
            onClick={loadBarang}
            disabled={loading}
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              border-[#D5E5DC]
              bg-white
              px-4
              py-2.5
              text-sm
              font-semibold
              text-gray-700
              shadow-sm
              transition
              hover:bg-[#F5F8F6]
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />

            Refresh
          </button>

          {/* IMPORT */}

          <button
            type="button"
            onClick={() => setOpenImport(true)}
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
              transition
              hover:bg-[#3E6E61]
            "
          >
            <Upload size={17} />

            Import Excel
          </button>

        </div>

      </div>

      {/* ======================================
          FILTER SUMBER BARANG
      ====================================== */}

      <div
        className="
          mb-6
          rounded-2xl
          border
          border-[#DDE9E4]
          bg-white
          p-4
          shadow-sm
        "
      >

        <div className="mb-3 text-sm font-semibold text-[#18352D]">
          Sumber Barang
        </div>

        <div className="flex flex-wrap gap-2">

          {/* PUSAT */}

          <button
            type="button"
            onClick={() => setSource("CENTRAL")}
            className={`
              inline-flex
              items-center
              gap-2
              rounded-xl
              px-4
              py-2.5
              text-sm
              font-semibold
              transition

              ${
                source === "CENTRAL"
                  ? "bg-[#497F70] text-white shadow-sm"
                  : "border border-[#D5E5DC] bg-white text-gray-600 hover:bg-[#F5F8F6]"
              }
            `}
          >
            <Warehouse size={17} />

            Barang Pusat
          </button>

          {/* OUTLET */}

          <button
            type="button"
            onClick={() => setSource("OUTLET")}
            className={`
              inline-flex
              items-center
              gap-2
              rounded-xl
              px-4
              py-2.5
              text-sm
              font-semibold
              transition

              ${
                source === "OUTLET"
                  ? "bg-[#497F70] text-white shadow-sm"
                  : "border border-[#D5E5DC] bg-white text-gray-600 hover:bg-[#F5F8F6]"
              }
            `}
          >
            <Store size={17} />

            Barang Outlet
          </button>

          {/* SEMUA */}

          <button
            type="button"
            onClick={() => setSource("ALL")}
            className={`
              inline-flex
              items-center
              gap-2
              rounded-xl
              px-4
              py-2.5
              text-sm
              font-semibold
              transition

              ${
                source === "ALL"
                  ? "bg-[#497F70] text-white shadow-sm"
                  : "border border-[#D5E5DC] bg-white text-gray-600 hover:bg-[#F5F8F6]"
              }
            `}
          >
            <Boxes size={17} />

            Semua Barang
          </button>

        </div>

      </div>

      {/* ======================================
          TAMBAH BARANG
      ====================================== */}

      {source !== "OUTLET" && (
        <div
          className="
            mb-6
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
            md:p-6
          "
        >

          <div className="mb-5 flex items-center gap-3">

            <div
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-xl
                bg-[#EAF3EF]
                text-[#497F70]
              "
            >
              <Plus size={19} />
            </div>

            <div>

              <h2 className="font-semibold text-[#18352D]">
                Tambah Barang
              </h2>

              <p className="mt-0.5 text-xs text-gray-500">
                Tambahkan barang baru ke master inventory pusat
              </p>

            </div>

          </div>

          <BarangForm reload={loadBarang} />

        </div>
      )}

      {/* ======================================
          DAFTAR BARANG
      ====================================== */}

      <div
        className="
          overflow-hidden
          rounded-2xl
          border
          border-[#DDE9E4]
          bg-white
          shadow-sm
        "
      >

        {/* TABLE HEADER */}

        <div
          className="
            border-b
            border-[#E5ECE9]
            px-5
            py-4
            md:px-6
          "
        >

          <div
            className="
              flex
              flex-col
              gap-3
              md:flex-row
              md:items-center
              md:justify-between
            "
          >

            <div className="flex items-center gap-3">

              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-[#EAF3EF]
                  text-[#497F70]
                "
              >
                <Search size={19} />
              </div>

              <div>

                <h2 className="font-semibold text-[#18352D]">
                  {sourceLabel}
                </h2>

                <p className="mt-0.5 text-xs text-gray-500">
                  Data master barang inventory perusahaan
                </p>

              </div>

            </div>

            {/* TOTAL */}

            <div
              className="
                inline-flex
                w-fit
                items-center
                gap-1.5
                rounded-full
                bg-[#EAF3EF]
                px-3
                py-1
                text-xs
                font-semibold
                text-[#497F70]
              "
            >

              <Package size={13} />

              {barang.length} Item

            </div>

          </div>

        </div>

        {/* SEARCH */}

        <div
          className="
            border-b
            border-[#E5ECE9]
            bg-[#FAFCFB]
            px-5
            py-4
            md:px-6
          "
        >
          <SearchBar
            search={search}
            setSearch={setSearch}
          />
        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          {loading ? (

            <div
              className="
                flex
                min-h-[250px]
                flex-col
                items-center
                justify-center
                text-center
              "
            >

              <RefreshCw
                size={25}
                className="animate-spin text-[#497F70]"
              />

              <p className="mt-3 text-sm text-gray-500">
                Memuat data barang...
              </p>

            </div>

          ) : barang.length === 0 ? (

            <div
              className="
                flex
                min-h-[250px]
                flex-col
                items-center
                justify-center
                px-5
                text-center
              "
            >

              <div
                className="
                  flex
                  h-14
                  w-14
                  items-center
                  justify-center
                  rounded-2xl
                  bg-[#EAF3EF]
                  text-[#497F70]
                "
              >
                <Package size={27} />
              </div>

              <h3 className="mt-4 font-semibold text-[#18352D]">
                Data barang tidak ditemukan
              </h3>

              <p className="mt-1 text-sm text-gray-400">
                Tidak ada data pada filter {sourceLabel}.
              </p>

            </div>

          ) : (

            <BarangTable
              data={barang}
              reload={loadBarang}
            />

          )}

        </div>

        {/* FOOTER */}

        <div
          className="
            flex
            flex-col
            justify-between
            gap-2
            border-t
            border-[#E5ECE9]
            bg-[#F5F8F6]
            px-5
            py-4
            text-sm
            md:flex-row
            md:items-center
            md:px-6
          "
        >

          <div className="text-gray-500">

            Menampilkan{" "}

            <span className="font-semibold text-[#18352D]">
              {barang.length}
            </span>{" "}

            barang

          </div>

          <div
            className="
              flex
              items-center
              gap-2
              font-medium
              text-[#35564C]
            "
          >

            <Package
              size={15}
              className="text-[#497F70]"
            />

            {sourceLabel}

          </div>

        </div>

      </div>

      {/* ======================================
          IMPORT MODAL
      ====================================== */}

      <ImportBarangModal
        open={openImport}
        onClose={() => setOpenImport(false)}
        reload={loadBarang}
      />

    </div>
  );
}