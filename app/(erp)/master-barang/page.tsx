"use client";

import { useEffect, useState } from "react";
import {
  Package,
  Upload,
  Plus,
  Search,
  Boxes,
} from "lucide-react";

import BarangForm from "@/components/master/barang/BarangForm";
import BarangTable from "@/components/master/barang/BarangTable";
import SearchBar from "@/components/master/barang/SearchBar";
import ImportBarangModal from "@/components/master/barang/ImportBarangModal";

export default function BarangPage() {
  const [barang, setBarang] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [openImport, setOpenImport] = useState(false);

  async function loadBarang() {
    try {
      const res = await fetch(
        `/api/master/barang?search=${search}`,
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
      console.error("Load barang error", error);
      setBarang([]);
    }
  }

  useEffect(() => {
    loadBarang();
  }, [search]);

  return (
    <div
      className="
        min-h-screen
        bg-[#F8FBF9]
        p-6
        md:p-8
      "
    >
      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

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

        <div className="flex items-center gap-2">
          <div
            className="
              hidden
              items-center
              gap-2
              rounded-xl
              border
              border-[#DDE9E4]
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
              py-3
              text-sm
              font-semibold
              text-white
              shadow-sm
              transition
              hover:bg-[#3D6D60]
            "
          >
            <Upload size={18} />

            Import Excel
          </button>
        </div>
      </div>

      {/* ================================================= */}
      {/* FORM TAMBAH BARANG */}
      {/* ================================================= */}

      <div
        className="
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
              Tambahkan barang baru ke master inventory
            </p>
          </div>
        </div>

        <BarangForm />
      </div>

      {/* ================================================= */}
      {/* DAFTAR BARANG */}
      {/* ================================================= */}

      <div
        className="
          mt-6
          overflow-hidden
          rounded-2xl
          border
          border-[#DDE9E4]
          bg-white
          shadow-sm
        "
      >
        {/* HEADER DAFTAR */}

        <div
          className="
            border-b
            border-[#E5ECE9]
            px-5
            py-4
            md:px-6
          "
        >
          <div className="flex items-center justify-between">
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
                  Daftar Barang
                </h2>

                <p className="mt-0.5 text-xs text-gray-500">
                  Data master barang inventory perusahaan
                </p>
              </div>
            </div>

            <div
              className="
                rounded-full
                bg-[#EAF3EF]
                px-3
                py-1
                text-xs
                font-semibold
                text-[#497F70]
              "
            >
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
          <BarangTable
            data={barang}
            reload={loadBarang}
          />
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

          <div className="flex items-center gap-2 font-medium text-[#35564C]">
            <Package
              size={15}
              className="text-[#497F70]"
            />

            Master Inventory
          </div>
        </div>
      </div>

      {/* ================================================= */}
      {/* IMPORT MODAL */}
      {/* ================================================= */}

      <ImportBarangModal
        open={openImport}
        onClose={() => setOpenImport(false)}
        reload={loadBarang}
      />
    </div>
  );
}