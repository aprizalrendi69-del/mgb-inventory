"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Package,
  Upload,
  Plus,
  Search,
  Boxes,
  RefreshCw,
  Warehouse,
  Store,
  Copy,
  Filter,
  X,
  ShieldCheck,
  ShieldAlert,
  History,
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
  const [openTambahBarang, setOpenTambahBarang] = useState(false);
  const [loading, setLoading] = useState(false);

  /*
  =========================================================
  FILTER DUPLIKAT NAMA BARANG
  =========================================================
  */

  const [showDuplicates, setShowDuplicates] = useState(false);

  /*
  =========================================================
  FILTER STATUS HAPUS
  =========================================================

  ALL
  SAFE = aman dihapus
  USED = sudah ada history/transaksi

  =========================================================
  */

  const [deleteFilter, setDeleteFilter] = useState<
    "ALL" | "SAFE" | "USED"
  >("ALL");

  /*
  =========================================================
  LOAD BARANG
  =========================================================
  */

  async function loadBarang() {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

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
        setBarang(Array.isArray(json.data) ? json.data : []);
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

  /*
  =========================================================
  LOAD SAAT FILTER BERUBAH
  =========================================================
  */

  useEffect(() => {
    loadBarang();
  }, [search, source]);

  /*
  =========================================================
  NORMALIZE NAMA BARANG
  =========================================================

  Tujuan:
  - "Ayam Goreng"       = "ayam goreng"
  - "AYAM GORENG"       = "ayam goreng"
  - " ayam goreng "     = "ayam goreng"
  - "ayam   goreng"     = "ayam goreng"
  - whitespace Unicode  = normal space

  Jadi semua dianggap nama yang sama.
  =========================================================
  */

  function normalizeName(value: any) {
    return String(value ?? "")
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("id-ID");
  }

  /*
  =========================================================
  DUPLICATE GROUPS
  =========================================================

  Contoh:

  1. Ayam Goreng
  2. AYAM GORENG
  3. ayam   goreng
  4.  Ayam Goreng

  Akan menjadi:

  {
    key: "ayam goreng",
    name: "Ayam Goreng",
    items: [1,2,3,4]
  }

  =========================================================
  */

  const duplicateGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        name: string;
        items: any[];
      }
    >();

    for (const item of barang) {
      const normalizedName = normalizeName(item?.name);

      if (!normalizedName) {
        continue;
      }

      const existing = groups.get(normalizedName);

      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(normalizedName, {
          name: String(item?.name ?? "").trim(),
          items: [item],
        });
      }
    }

    return Array.from(groups.entries())
      .filter(([, group]) => group.items.length > 1)
      .map(([key, group]) => ({
        key,
        name: group.name,
        items: group.items,
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name, "id-ID", {
          sensitivity: "base",
        })
      );
  }, [barang]);

  /*
  =========================================================
  DUPLICATE BARANG IDS
  =========================================================

  Semua ID yang berada di dalam kelompok nama duplikat
  akan ditampilkan ketika filter "Duplikat" aktif.

  =========================================================
  */

  const duplicateBarangIds = useMemo(() => {
    const ids = new Set<number>();

    for (const group of duplicateGroups) {
      for (const item of group.items) {
        const id = Number(item?.id);

        if (Number.isFinite(id)) {
          ids.add(id);
        }
      }
    }

    return ids;
  }, [duplicateGroups]);

  /*
  =========================================================
  BARANG AMAN DIHAPUS
  =========================================================
  */

  const safeDeleteCount = useMemo(() => {
    return barang.filter(
      (item) => item?.canDelete === true
    ).length;
  }, [barang]);

  /*
  =========================================================
  BARANG SUDAH DIGUNAKAN
  =========================================================
  */

  const usedCount = useMemo(() => {
    return barang.filter(
      (item) => item?.canDelete === false
    ).length;
  }, [barang]);

  /*
  =========================================================
  DUPLIKAT COUNT
  =========================================================
  */

  const duplicateGroupCount = duplicateGroups.length;

  const duplicateItemCount = useMemo(() => {
    return duplicateGroups.reduce(
      (total, group) => total + group.items.length,
      0
    );
  }, [duplicateGroups]);

  /*
  =========================================================
  DATA YANG DITAMPILKAN
  =========================================================
  */

  const displayedBarang = useMemo(() => {
    let result = [...barang];

    /*
    ---------------------------------------------------------
    FILTER DUPLIKAT
    ---------------------------------------------------------
    */

    if (showDuplicates) {
      result = result.filter((item) => {
        const id = Number(item?.id);

        return (
          Number.isFinite(id) &&
          duplicateBarangIds.has(id)
        );
      });
    }

    /*
    ---------------------------------------------------------
    FILTER STATUS DELETE
    ---------------------------------------------------------
    */

    if (deleteFilter === "SAFE") {
      result = result.filter(
        (item) => item?.canDelete === true
      );
    }

    if (deleteFilter === "USED") {
      result = result.filter(
        (item) => item?.canDelete === false
      );
    }

    /*
    ---------------------------------------------------------
    SORT SAAT FILTER DUPLIKAT AKTIF
    ---------------------------------------------------------

    Barang dengan nama yang sama dikelompokkan berdekatan
    agar lebih mudah melihat mana yang double.
    */

    if (showDuplicates) {
      result.sort((a, b) => {
        const nameA = normalizeName(a?.name);
        const nameB = normalizeName(b?.name);

        const nameCompare = nameA.localeCompare(
          nameB,
          "id-ID",
          {
            sensitivity: "base",
          }
        );

        if (nameCompare !== 0) {
          return nameCompare;
        }

        return Number(a?.id ?? 0) - Number(b?.id ?? 0);
      });
    }

    return result;
  }, [
    barang,
    showDuplicates,
    duplicateBarangIds,
    deleteFilter,
  ]);

  /*
  =========================================================
  SOURCE LABEL
  =========================================================
  */

  const sourceLabel =
    source === "CENTRAL"
      ? "Barang Pusat"
      : source === "OUTLET"
      ? "Barang Outlet"
      : "Semua Barang";

  /*
  =========================================================
  RESET DUPLIKAT
  =========================================================
  */

  function clearDuplicateFilter() {
    setShowDuplicates(false);
  }

  /*
  =========================================================
  RESET DELETE FILTER
  =========================================================
  */

  function clearDeleteFilter() {
    setDeleteFilter("ALL");
  }

  /*
  =========================================================
  REFRESH
  =========================================================
  */

  function handleRefresh() {
    loadBarang();
  }

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* =====================================================
          HEADER
      ===================================================== */}

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
              Kelola master barang dan cek apakah barang
              sudah pernah digunakan dalam transaksi.
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

          {/* AMAN DIHAPUS */}

          <button
            type="button"
            onClick={() => {
              setDeleteFilter(
                deleteFilter === "SAFE"
                  ? "ALL"
                  : "SAFE"
              );

              setShowDuplicates(false);
            }}
            disabled={
              loading ||
              safeDeleteCount === 0
            }
            className={`
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              px-4
              py-2.5
              text-sm
              font-semibold
              shadow-sm
              transition

              ${
                deleteFilter === "SAFE"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
              }

              disabled:cursor-not-allowed
              disabled:opacity-50
            `}
          >
            <ShieldCheck size={17} />

            Aman Dihapus ({safeDeleteCount})
          </button>

          {/* SUDAH DIGUNAKAN */}

          <button
            type="button"
            onClick={() => {
              setDeleteFilter(
                deleteFilter === "USED"
                  ? "ALL"
                  : "USED"
              );

              setShowDuplicates(false);
            }}
            disabled={
              loading ||
              usedCount === 0
            }
            className={`
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              px-4
              py-2.5
              text-sm
              font-semibold
              shadow-sm
              transition

              ${
                deleteFilter === "USED"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-red-200 bg-white text-red-700 hover:bg-red-50"
              }

              disabled:cursor-not-allowed
              disabled:opacity-50
            `}
          >
            <ShieldAlert size={17} />

            Sudah Digunakan ({usedCount})
          </button>

          {/* DUPLIKAT */}

          <button
            type="button"
            onClick={() => {
              setShowDuplicates((prev) => !prev);
              setDeleteFilter("ALL");
            }}
            disabled={
              loading ||
              duplicateItemCount === 0
            }
            className={`
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              px-4
              py-2.5
              text-sm
              font-semibold
              shadow-sm
              transition

              ${
                showDuplicates
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-[#E6D7D7] bg-white text-red-600 hover:bg-red-50"
              }

              disabled:cursor-not-allowed
              disabled:opacity-50
            `}
          >
            {showDuplicates ? (
              <X size={17} />
            ) : (
              <Copy size={17} />
            )}

            {showDuplicates
              ? "Tampilkan Semua"
              : `Duplikat (${duplicateItemCount})`}
          </button>

          {/* REFRESH */}

          <button
            type="button"
            onClick={handleRefresh}
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
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>

          {/* IMPORT */}

          <button
            type="button"
            onClick={() =>
              setOpenImport(true)
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
              transition
              hover:bg-[#3E6E61]
            "
          >
            <Upload size={17} />

            Import Excel
          </button>

        </div>

      </div>

      {/* =====================================================
          STATUS SUMMARY
      ===================================================== */}

      <div
        className="
          mb-6
          grid
          grid-cols-1
          gap-3
          md:grid-cols-3
        "
      >

        {/* TOTAL */}

        <div
          className="
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-4
            shadow-sm
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
              <Package size={19} />
            </div>

            <div>

              <p className="text-xs text-gray-500">
                Total Barang
              </p>

              <p className="text-xl font-bold text-[#18352D]">
                {barang.length}
              </p>

            </div>

          </div>

        </div>

        {/* AMAN */}

        <div
          className="
            rounded-2xl
            border
            border-emerald-200
            bg-emerald-50
            p-4
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
                bg-emerald-100
                text-emerald-700
              "
            >
              <ShieldCheck size={19} />
            </div>

            <div>

              <p className="text-xs text-emerald-700">
                Aman Dihapus
              </p>

              <p className="text-xl font-bold text-emerald-800">
                {safeDeleteCount}
              </p>

            </div>

          </div>

        </div>

        {/* SUDAH DIGUNAKAN */}

        <div
          className="
            rounded-2xl
            border
            border-red-200
            bg-red-50
            p-4
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
                bg-red-100
                text-red-700
              "
            >
              <History size={19} />
            </div>

            <div>

              <p className="text-xs text-red-700">
                Sudah Ada History
              </p>

              <p className="text-xl font-bold text-red-800">
                {usedCount}
              </p>

            </div>

          </div>

        </div>

      </div>

      {/* =====================================================
          INFO STATUS
      ===================================================== */}

      <div
        className="
          mb-6
          rounded-2xl
          border
          border-blue-200
          bg-blue-50
          p-4
        "
      >

        <div className="flex items-start gap-3">

          <div
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-blue-100
              text-blue-700
            "
          >
            <History size={19} />
          </div>

          <div>

            <h3 className="font-semibold text-blue-900">
              Status penggunaan barang
            </h3>

            <p className="mt-1 text-sm leading-6 text-blue-700">
              Setiap barang sekarang diperiksa terhadap
              history dan relasi transaksi. Barang yang
              belum pernah digunakan dan stock-nya 0 akan
              ditandai <strong>Aman Dihapus</strong>.
              Barang yang sudah mempunyai transaksi,
              history, BOM, purchase, POS, manufacture,
              stock card, outlet stock, atau relasi lain
              akan ditandai <strong>Tidak Bisa Dihapus</strong>.
            </p>

          </div>

        </div>

      </div>

      {/* =====================================================
          DUPLICATE INFO
      ===================================================== */}

      {duplicateItemCount > 0 && (
        <div
          className="
            mb-6
            rounded-2xl
            border
            border-amber-200
            bg-amber-50
            p-4
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

            <div className="flex items-start gap-3">

              <div
                className="
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  bg-amber-100
                  text-amber-700
                "
              >
                <Copy size={19} />
              </div>

              <div>

                <h3 className="font-semibold text-amber-900">
                  Ditemukan barang duplikat
                </h3>

                <p className="mt-1 text-sm text-amber-700">
                  Terdapat{" "}
                  <strong>
                    {duplicateGroupCount}
                  </strong>{" "}
                  kelompok nama barang yang sama,
                  dengan total{" "}
                  <strong>
                    {duplicateItemCount}
                  </strong>{" "}
                  data barang.
                </p>

              </div>

            </div>

            <button
              type="button"
              onClick={() => {
                setShowDuplicates(true);
                setDeleteFilter("ALL");
              }}
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-amber-600
                px-4
                py-2.5
                text-sm
                font-semibold
                text-white
                transition
                hover:bg-amber-700
              "
            >
              <Filter size={16} />

              Lihat Duplikat
            </button>

          </div>

        </div>
      )}

      {/* =====================================================
          FILTER SUMBER BARANG
      ===================================================== */}

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

          {/* CENTRAL */}

          <button
            type="button"
            onClick={() => {
              setSource("CENTRAL");
              setShowDuplicates(false);
              setDeleteFilter("ALL");
            }}
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
            onClick={() => {
              setSource("OUTLET");
              setShowDuplicates(false);
              setDeleteFilter("ALL");
            }}
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

          {/* ALL */}

          <button
            type="button"
            onClick={() => {
              setSource("ALL");
              setShowDuplicates(false);
              setDeleteFilter("ALL");
            }}
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

      {/* =====================================================
          FILTER STATUS
      ===================================================== */}

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
          Filter Status Barang
        </div>

        <div className="flex flex-wrap gap-2">

          {/* SEMUA */}

          <button
            type="button"
            onClick={() => {
              setDeleteFilter("ALL");
              setShowDuplicates(false);
            }}
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
                deleteFilter === "ALL" &&
                !showDuplicates
                  ? "bg-[#497F70] text-white shadow-sm"
                  : "border border-[#D5E5DC] bg-white text-gray-600 hover:bg-[#F5F8F6]"
              }
            `}
          >
            <Boxes size={17} />

            Semua
          </button>

          {/* AMAN */}

          <button
            type="button"
            onClick={() => {
              setDeleteFilter("SAFE");
              setShowDuplicates(false);
            }}
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
                deleteFilter === "SAFE"
                  ? "bg-emerald-600 text-white"
                  : "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
              }
            `}
          >
            <ShieldCheck size={17} />

            Aman Dihapus
          </button>

          {/* USED */}

          <button
            type="button"
            onClick={() => {
              setDeleteFilter("USED");
              setShowDuplicates(false);
            }}
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
                deleteFilter === "USED"
                  ? "bg-red-600 text-white"
                  : "border border-red-200 bg-white text-red-700 hover:bg-red-50"
              }
            `}
          >
            <ShieldAlert size={17} />

            Sudah Ada History
          </button>

          {/* DUPLIKAT */}

          <button
            type="button"
            onClick={() => {
              setShowDuplicates((prev) => !prev);
              setDeleteFilter("ALL");
            }}
            disabled={
              loading ||
              duplicateItemCount === 0
            }
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
                showDuplicates
                  ? "bg-red-600 text-white"
                  : "border border-red-200 bg-white text-red-700 hover:bg-red-50"
              }

              disabled:cursor-not-allowed
              disabled:opacity-50
            `}
          >
            <Copy size={17} />

            Duplikat ({duplicateItemCount})
          </button>

          {/* RESET */}

          {(deleteFilter !== "ALL" ||
            showDuplicates) && (
            <button
              type="button"
              onClick={() => {
                clearDeleteFilter();
                clearDuplicateFilter();
              }}
              className="
                inline-flex
                items-center
                gap-2
                rounded-xl
                border
                border-gray-200
                bg-white
                px-4
                py-2.5
                text-sm
                font-semibold
                text-gray-600
                hover:bg-gray-50
              "
            >
              <X size={17} />

              Reset Filter
            </button>
          )}

        </div>

      </div>

      {/* =====================================================
          ACTION TAMBAH BARANG
      ===================================================== */}

      {source !== "OUTLET" && (
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => setOpenTambahBarang(true)}
            className="group inline-flex items-center gap-3 rounded-2xl border border-emerald-700/10 bg-gradient-to-r from-[#18352D] via-[#2F6253] to-[#497F70] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_-12px_rgba(24,53,45,0.55)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-12px_rgba(24,53,45,0.65)] active:translate-y-0"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 transition group-hover:bg-white/20">
              <Plus size={19} />
            </span>
            <span className="text-left">
              <span className="block leading-5">Tambah Barang</span>
              <span className="block text-[10px] font-medium text-white/70">Buat master barang baru</span>
            </span>
          </button>
        </div>
      )}

      {/* =====================================================
          DAFTAR BARANG
      ===================================================== */}

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

        {/* HEADER */}

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

                {showDuplicates ? (
                  <Copy size={19} />
                ) : deleteFilter === "SAFE" ? (
                  <ShieldCheck size={19} />
                ) : deleteFilter === "USED" ? (
                  <History size={19} />
                ) : (
                  <Search size={19} />
                )}

              </div>

              <div>

                <div className="flex items-center gap-2">

                  <h2 className="font-semibold text-[#18352D]">

                    {showDuplicates
                      ? "Barang Duplikat"
                      : deleteFilter === "SAFE"
                      ? "Barang Aman Dihapus"
                      : deleteFilter === "USED"
                      ? "Barang Sudah Digunakan"
                      : sourceLabel}

                  </h2>

                  {showDuplicates && (
                    <span
                      className="
                        rounded-full
                        bg-red-100
                        px-2.5
                        py-1
                        text-[11px]
                        font-bold
                        text-red-700
                      "
                    >
                      DUPLIKAT
                    </span>
                  )}

                </div>

                <p className="mt-0.5 text-xs text-gray-500">

                  {showDuplicates
                    ? "Menampilkan semua barang yang mempunyai nama sama"
                    : deleteFilter === "SAFE"
                    ? "Barang yang belum memiliki history/relasi dan stock 0"
                    : deleteFilter === "USED"
                    ? "Barang yang sudah digunakan dalam transaksi atau relasi lain"
                    : "Data master barang inventory perusahaan"}

                </p>

              </div>

            </div>

            {/* TOTAL */}

            <div className="flex items-center gap-2">

              {(showDuplicates ||
                deleteFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setShowDuplicates(false);
                    setDeleteFilter("ALL");
                  }}
                  className="
                    inline-flex
                    items-center
                    gap-1.5
                    rounded-full
                    border
                    border-gray-200
                    bg-white
                    px-3
                    py-1
                    text-xs
                    font-semibold
                    text-gray-600
                    hover:bg-gray-50
                  "
                >
                  <X size={13} />

                  Reset
                </button>
              )}

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

                {displayedBarang.length} Item

              </div>

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

        {/* ===================================================
            DUPLICATE GROUP
        =================================================== */}

        {showDuplicates &&
          duplicateGroups.length > 0 && (
            <div
              className="
                border-b
                border-[#E5ECE9]
                bg-[#FFFDFC]
                px-5
                py-4
                md:px-6
              "
            >

              <div className="mb-3 text-sm font-semibold text-[#18352D]">
                Kelompok Duplikat
              </div>

              <div className="flex flex-wrap gap-2">

                {duplicateGroups.map(
                  (group) => (
                    <div
                      key={group.key}
                      className="
                        inline-flex
                        items-center
                        gap-2
                        rounded-xl
                        border
                        border-red-100
                        bg-red-50
                        px-3
                        py-2
                        text-xs
                      "
                    >

                      <Copy
                        size={13}
                        className="text-red-500"
                      />

                      <span className="font-semibold text-red-800">
                        {group.name}
                      </span>

                      <span
                        className="
                          rounded-full
                          bg-red-100
                          px-2
                          py-0.5
                          font-bold
                          text-red-700
                        "
                      >
                        {group.items.length}x
                      </span>

                    </div>
                  )
                )}

              </div>

            </div>
          )}

        {/* ===================================================
            TABLE
        =================================================== */}

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
                Memeriksa history dan relasi barang...
              </p>

            </div>

          ) : displayedBarang.length === 0 ? (

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

                {showDuplicates ? (
                  <Copy size={27} />
                ) : deleteFilter === "SAFE" ? (
                  <ShieldCheck size={27} />
                ) : deleteFilter === "USED" ? (
                  <History size={27} />
                ) : (
                  <Package size={27} />
                )}

              </div>

              <h3 className="mt-4 font-semibold text-[#18352D]">

                {showDuplicates
                  ? "Tidak ada duplikat"
                  : deleteFilter === "SAFE"
                  ? "Tidak ada barang yang aman dihapus"
                  : deleteFilter === "USED"
                  ? "Tidak ada barang yang mempunyai history"
                  : "Data barang tidak ditemukan"}

              </h3>

              <p className="mt-1 text-sm text-gray-400">

                {showDuplicates
                  ? "Tidak ditemukan nama barang yang sama pada data yang sedang dimuat."
                  : deleteFilter === "SAFE"
                  ? "Semua barang yang ditampilkan mempunyai stock atau sudah mempunyai relasi/history."
                  : deleteFilter === "USED"
                  ? "Tidak ditemukan barang dengan history pada data yang sedang dimuat."
                  : `Tidak ada data pada filter ${sourceLabel}.`}

              </p>

            </div>

          ) : (

            <BarangTable
              data={displayedBarang}
              reload={loadBarang}
            />

          )}

        </div>

        {/* ===================================================
            FOOTER
        =================================================== */}

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
              {displayedBarang.length}
            </span>{" "}

            barang

            {showDuplicates && (
              <>
                {" "}
                dari{" "}
                <span className="font-semibold text-[#18352D]">
                  {barang.length}
                </span>
              </>
            )}

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

            {showDuplicates ? (
              <>
                <Copy
                  size={15}
                  className="text-red-500"
                />

                {duplicateGroupCount} kelompok duplikat
              </>
            ) : deleteFilter === "SAFE" ? (
              <>
                <ShieldCheck
                  size={15}
                  className="text-emerald-600"
                />

                {safeDeleteCount} barang aman dihapus
              </>
            ) : deleteFilter === "USED" ? (
              <>
                <ShieldAlert
                  size={15}
                  className="text-red-600"
                />

                {usedCount} barang sudah digunakan
              </>
            ) : (
              <>
                <Package
                  size={15}
                  className="text-[#497F70]"
                />

                {sourceLabel}
              </>
            )}

          </div>

        </div>

      </div>

      {/* =====================================================
          TAMBAH BARANG — PREMIUM MODAL
      ===================================================== */}

      {openTambahBarang && source !== "OUTLET" && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tambah-barang-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpenTambahBarang(false);
          }}
        >
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[26px] border border-white/70 bg-white shadow-[0_30px_90px_-30px_rgba(15,23,42,0.55)]">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500" />

            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-emerald-50/50 px-5 py-4 sm:px-6 sm:py-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#18352D] to-[#497F70] text-white shadow-lg shadow-emerald-900/15">
                  <Plus size={21} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="tambah-barang-title" className="truncate text-lg font-bold tracking-tight text-[#18352D] sm:text-xl">
                      Tambah Barang
                    </h2>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                      Master Data
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                    Buat data barang baru untuk inventory pusat.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpenTambahBarang(false)}
                aria-label="Tutup form tambah barang"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <X size={19} />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto bg-white p-4 sm:p-6">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3 sm:p-5">
                <BarangForm
                  reload={async () => {
                    await loadBarang();
                    setOpenTambahBarang(false);
                  }}
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3 text-[11px] text-slate-500 sm:px-6">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                ✓
              </span>
              Lengkapi data barang dengan benar sebelum menyimpan.
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          IMPORT MODAL
      ===================================================== */}

      <ImportBarangModal
        open={openImport}
        onClose={() =>
          setOpenImport(false)
        }
        reload={loadBarang}
      />

    </div>
  );
}