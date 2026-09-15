"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Upload,
  Plus,
  Pencil,
  Trash2,
  Users,
  Clock3,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import ImportSupplierModal from "@/components/supplier/ImportSupplierModal";

type Supplier = {
  id: number;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  contactPerson: string | null;
  tempoDays: number;
};

export default function SupplierPage() {
  const [supplier, setSupplier] =
    useState<Supplier[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [openImport, setOpenImport] =
    useState(false);

  // =====================================================
  // FILTER
  // =====================================================

  const [search, setSearch] =
    useState("");

  const [tempoFilter, setTempoFilter] =
    useState("ALL");

  // =====================================================
  // LOAD SUPPLIER
  // =====================================================

  async function load() {
    try {
      setLoading(true);

      const res = await fetch(
        "/api/supplier",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (json.success) {
        setSupplier(
          Array.isArray(json.data)
            ? json.data
            : []
        );
      } else {
        alert(
          json.message ||
            "Gagal mengambil data supplier"
        );
      }
    } catch (error) {
      console.error(error);

      alert(
        "Gagal mengambil data supplier"
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // DELETE SUPPLIER
  // =====================================================

  async function hapusSupplier(
    id: number
  ) {
    const ok = confirm(
      "Yakin ingin menghapus supplier ini?"
    );

    if (!ok) return;

    try {
      const res = await fetch(
        `/api/supplier/${id}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      alert(json.message);

      if (json.success) {
        load();
      }
    } catch (error) {
      console.error(error);

      alert(
        "Gagal menghapus supplier"
      );
    }
  }

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    load();
  }, []);

  // =====================================================
  // FILTER DATA
  // =====================================================

  const filteredSupplier =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return supplier.filter(
        (item) => {
          // ---------------------------------------------
          // SEARCH
          // ---------------------------------------------

          const matchesSearch =
            !keyword ||
            item.code
              .toLowerCase()
              .includes(keyword) ||
            item.name
              .toLowerCase()
              .includes(keyword) ||
            (item.city ?? "")
              .toLowerCase()
              .includes(keyword) ||
            (item.contactPerson ?? "")
              .toLowerCase()
              .includes(keyword) ||
            (item.phone ?? "")
              .toLowerCase()
              .includes(keyword) ||
            (item.email ?? "")
              .toLowerCase()
              .includes(keyword);

          if (!matchesSearch) {
            return false;
          }

          // ---------------------------------------------
          // TEMPO
          // ---------------------------------------------

          if (tempoFilter === "ALL") {
            return true;
          }

          const tempo =
            Number(
              item.tempoDays ?? 30
            );

          if (
            tempoFilter === "COD"
          ) {
            return tempo === 0;
          }

          return (
            tempo ===
            Number(tempoFilter)
          );
        }
      );
    }, [
      supplier,
      search,
      tempoFilter,
    ]);

  // =====================================================
  // CUSTOM TEMPO OPTIONS
  // =====================================================

  const customTempoOptions =
    useMemo(() => {
      const standard = [
        0,
        14,
        30,
        45,
        60,
      ];

      return Array.from(
        new Set(
          supplier
            .map((item) =>
              Number(
                item.tempoDays ?? 30
              )
            )
            .filter(
              (tempo) =>
                !standard.includes(
                  tempo
                )
            )
        )
      ).sort(
        (a, b) => a - b
      );
    }, [supplier]);

  // =====================================================
  // RESET FILTER
  // =====================================================

  function resetFilter() {
    setSearch("");
    setTempoFilter("ALL");
  }

  const isFiltered =
    search.trim() !== "" ||
    tempoFilter !== "ALL";

  // =====================================================
  // FORMAT TEMPO
  // =====================================================

  function renderTempo(
    tempoDays:
      | number
      | null
      | undefined
  ) {
    const tempo = Number(
      tempoDays ?? 30
    );

    if (tempo === 0) {
      return (
        <span
          className="
            inline-flex
            items-center
            gap-1.5
            rounded-full
            bg-[#E4F3E9]
            px-3
            py-1.5
            text-xs
            font-bold
            text-[#3E765F]
          "
        >
          <Clock3 size={13} />

          COD / Hari Ini
        </span>
      );
    }

    return (
      <span
        className="
          inline-flex
          items-center
          gap-1.5
          rounded-full
          bg-[#E5F0F7]
          px-3
          py-1.5
          text-xs
          font-bold
          text-[#47728A]
        "
      >
        <Clock3 size={13} />

        {tempo} Hari
      </span>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div
      className="
        min-h-screen
        bg-[#F8FBF9]
        p-6
        md:p-8
      "
    >

      {/* =================================================
          HEADER
      ================================================= */}

      <div
        className="
          mb-6
          flex
          flex-col
          gap-4
          md:flex-row
          md:items-center
          md:justify-between
        "
      >

        {/* LEFT */}

        <div
          className="
            flex
            items-center
            gap-3
          "
        >

          <div
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-2xl
              bg-[#E8F3EC]
            "
          >

            <Building2
              size={24}
              className="text-[#497F70]"
            />

          </div>

          <div>

            <h1
              className="
                text-2xl
                font-bold
                text-[#29483A]
              "
            >
              Master Supplier
            </h1>

            <p
              className="
                text-sm
                text-[#71827A]
              "
            >
              Kelola data supplier dan
              ketentuan pembayaran
            </p>

          </div>

        </div>

        {/* RIGHT */}

        <div
          className="
            flex
            gap-3
          "
        >

          {/* IMPORT */}

          <button
            type="button"
            onClick={() =>
              setOpenImport(true)
            }
            className="
              flex
              items-center
              gap-2
              rounded-xl
              bg-[#497F70]
              px-5
              py-3
              text-sm
              font-semibold
              text-white
              hover:bg-[#3E6E61]
            "
          >

            <Upload size={18} />

            Import Excel

          </button>

          {/* ADD */}

          <Link
            href="/supplier/new"
            className="
              flex
              items-center
              gap-2
              rounded-xl
              bg-[#29483A]
              px-5
              py-3
              text-sm
              font-semibold
              text-white
              hover:bg-[#1F392F]
            "
          >

            <Plus size={18} />

            Supplier

          </Link>

        </div>

      </div>

      {/* =================================================
          TEMPO INFO
      ================================================= */}

      <div
        className="
          mb-6
          rounded-2xl
          border
          border-[#D5E5DC]
          bg-[#F9FCFA]
          p-5
          shadow-[0_4px_20px_rgba(73,127,112,0.05)]
        "
      >

        <div
          className="
            flex
            flex-col
            gap-4
            md:flex-row
            md:items-center
            md:justify-between
          "
        >

          <div
            className="
              flex
              items-start
              gap-3
            "
          >

            <div
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-[#E8F3EC]
              "
            >

              <Clock3
                size={20}
                className="text-[#497F70]"
              />

            </div>

            <div>

              <h3
                className="
                  text-sm
                  font-bold
                  text-[#29483A]
                "
              >
                Tempo Pembayaran
              </h3>

              <p
                className="
                  mt-1
                  text-xs
                  leading-5
                  text-[#71827A]
                "
              >
                Tempo dihitung sejak tanggal
                penerimaan barang.
              </p>

            </div>

          </div>

          <div
            className="
              text-xs
              text-[#71827A]
              md:text-right
            "
          >
            Contoh: tempo 30 hari dan barang
            diterima 5 September
            <br className="hidden md:block" />
            → jatuh tempo 5 Oktober.
          </div>

        </div>

      </div>

      {/* =================================================
          FILTER
      ================================================= */}

      <div
        className="
          mb-6
          rounded-2xl
          border
          border-[#D5E5DC]
          bg-[#F9FCFA]
          p-5
          shadow-[0_4px_20px_rgba(73,127,112,0.05)]
        "
      >

        <div
          className="
            mb-4
            flex
            items-center
            gap-2
          "
        >

          <Search
            size={19}
            className="text-[#497F70]"
          />

          <h3
            className="
              text-sm
              font-bold
              text-[#29483A]
            "
          >
            Filter Supplier
          </h3>

        </div>

        <div
          className="
            grid
            grid-cols-1
            gap-4
            md:grid-cols-[1fr_220px_auto]
            md:items-end
          "
        >

          {/* SEARCH */}

          <div>

            <label
              className="
                mb-2
                block
                text-xs
                font-semibold
                text-[#71827A]
              "
            >
              Pencarian
            </label>

            <div
              className="
                relative
              "
            >

              <Search
                size={17}
                className="
                  pointer-events-none
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-[#91A39A]
                "
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="
                  Cari kode, nama, kota,
                  contact, telepon, email...
                "
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-white
                  py-2.5
                  pl-10
                  pr-10
                  text-sm
                  outline-none
                  focus:border-[#497F70]
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />

              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                  className="
                    absolute
                    right-3
                    top-1/2
                    -translate-y-1/2
                    text-[#91A39A]
                    hover:text-[#29483A]
                  "
                >
                  <X size={16} />
                </button>
              )}

            </div>

          </div>

          {/* TEMPO FILTER */}

          <div>

            <label
              className="
                mb-2
                block
                text-xs
                font-semibold
                text-[#71827A]
              "
            >
              Tempo Pembayaran
            </label>

            <select
              value={tempoFilter}
              onChange={(e) =>
                setTempoFilter(
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
                text-[#29483A]
                outline-none
                focus:border-[#497F70]
                focus:ring-2
                focus:ring-[#497F70]/10
              "
            >

              <option value="ALL">
                Semua Tempo
              </option>

              <option value="COD">
                COD / 0 Hari
              </option>

              <option value="14">
                14 Hari
              </option>

              <option value="30">
                30 Hari
              </option>

              <option value="45">
                45 Hari
              </option>

              <option value="60">
                60 Hari
              </option>

              {customTempoOptions.map(
                (tempo) => (
                  <option
                    key={tempo}
                    value={String(
                      tempo
                    )}
                  >
                    {tempo} Hari
                  </option>
                )
              )}

            </select>

          </div>

          {/* RESET */}

          <button
            type="button"
            onClick={resetFilter}
            disabled={!isFiltered}
            className="
              flex
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
              text-[#497F70]
              hover:bg-[#F1F7F3]
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >

            <RefreshCw size={16} />

            Reset

          </button>

        </div>

        {/* FILTER RESULT */}

        <div
          className="
            mt-4
            flex
            flex-wrap
            items-center
            justify-between
            gap-2
            text-xs
            text-[#71827A]
          "
        >

          <span>
            Menampilkan{" "}
            <strong className="text-[#29483A]">
              {filteredSupplier.length}
            </strong>{" "}
            dari{" "}
            <strong className="text-[#29483A]">
              {supplier.length}
            </strong>{" "}
            supplier
          </span>

          {isFiltered && (
            <span
              className="
                rounded-full
                bg-[#E8F3EC]
                px-3
                py-1
                font-semibold
                text-[#497F70]
              "
            >
              Filter aktif
            </span>
          )}

        </div>

      </div>

      {/* =================================================
          TABLE CARD
      ================================================= */}

      <div
        className="
          overflow-hidden
          rounded-2xl
          border
          border-[#D5E5DC]
          bg-[#F9FCFA]
          shadow-[0_4px_20px_rgba(73,127,112,0.05)]
        "
      >

        {/* CARD HEADER */}

        <div
          className="
            flex
            items-center
            gap-2
            border-b
            border-[#E5EEE9]
            p-6
          "
        >

          <Users
            size={20}
            className="text-[#497F70]"
          />

          <div>

            <h2
              className="
                font-semibold
                text-[#29483A]
              "
            >
              Data Supplier
            </h2>

            <p
              className="
                text-xs
                text-[#71827A]
              "
            >
              {filteredSupplier.length} supplier
              ditampilkan
            </p>

          </div>

        </div>

        {/* TABLE */}

        <div
          className="
            overflow-x-auto
          "
        >

          <table
            className="
              w-full
              border-collapse
            "
          >

            <thead>

              <tr
                className="
                  bg-[#E8F3EC]
                  text-[#29483A]
                "
              >

                <th
                  className="
                    whitespace-nowrap
                    p-3
                    text-left
                    text-sm
                  "
                >
                  Kode
                </th>

                <th
                  className="
                    whitespace-nowrap
                    p-3
                    text-left
                    text-sm
                  "
                >
                  Nama
                </th>

                <th
                  className="
                    whitespace-nowrap
                    p-3
                    text-left
                    text-sm
                  "
                >
                  Kota
                </th>

                <th
                  className="
                    whitespace-nowrap
                    p-3
                    text-left
                    text-sm
                  "
                >
                  Contact
                </th>

                <th
                  className="
                    whitespace-nowrap
                    p-3
                    text-left
                    text-sm
                  "
                >
                  Telepon
                </th>

                <th
                  className="
                    whitespace-nowrap
                    p-3
                    text-left
                    text-sm
                  "
                >
                  Email
                </th>

                <th
                  className="
                    whitespace-nowrap
                    p-3
                    text-center
                    text-sm
                  "
                >
                  Tempo Pembayaran
                </th>

                <th
                  className="
                    whitespace-nowrap
                    p-3
                    text-center
                    text-sm
                  "
                >
                  Aksi
                </th>

              </tr>

            </thead>

            <tbody>

              {/* =================================================
                  LOADING
              ================================================= */}

              {loading ? (

                <tr>

                  <td
                    colSpan={8}
                    className="
                      p-10
                      text-center
                      text-[#71827A]
                    "
                  >

                    <div
                      className="
                        flex
                        items-center
                        justify-center
                        gap-2
                      "
                    >

                      <RefreshCw
                        size={18}
                        className="animate-spin"
                      />

                      Loading...

                    </div>

                  </td>

                </tr>

              ) : filteredSupplier.length === 0 ? (

                /* =================================================
                    EMPTY
                ================================================= */

                <tr>

                  <td
                    colSpan={8}
                    className="
                      p-10
                      text-center
                      text-[#71827A]
                    "
                  >

                    <div
                      className="
                        flex
                        flex-col
                        items-center
                        justify-center
                        gap-2
                      "
                    >

                      <Search
                        size={30}
                        className="text-[#A7B8AF]"
                      />

                      <p className="font-medium">
                        {supplier.length === 0
                          ? "Belum ada data supplier"
                          : "Supplier tidak ditemukan"}
                      </p>

                      {supplier.length > 0 && (
                        <button
                          type="button"
                          onClick={resetFilter}
                          className="
                            text-xs
                            font-semibold
                            text-[#497F70]
                            hover:underline
                          "
                        >
                          Reset filter
                        </button>
                      )}

                    </div>

                  </td>

                </tr>

              ) : (

                /* =================================================
                    DATA
                ================================================= */

                filteredSupplier.map(
                  (item) => (

                    <tr
                      key={item.id}
                      className="
                        border-t
                        border-[#E5EEE9]
                        hover:bg-[#F1F7F3]
                      "
                    >

                      {/* KODE */}

                      <td
                        className="
                          whitespace-nowrap
                          p-3
                          text-sm
                        "
                      >
                        {item.code}
                      </td>

                      {/* NAMA */}

                      <td
                        className="
                          whitespace-nowrap
                          p-3
                          text-sm
                          font-medium
                          text-[#29483A]
                        "
                      >
                        {item.name}
                      </td>

                      {/* KOTA */}

                      <td
                        className="
                          whitespace-nowrap
                          p-3
                          text-sm
                        "
                      >
                        {item.city ?? "-"}
                      </td>

                      {/* CONTACT */}

                      <td
                        className="
                          whitespace-nowrap
                          p-3
                          text-sm
                        "
                      >
                        {item.contactPerson ??
                          "-"}
                      </td>

                      {/* PHONE */}

                      <td
                        className="
                          whitespace-nowrap
                          p-3
                          text-sm
                        "
                      >
                        {item.phone ?? "-"}
                      </td>

                      {/* EMAIL */}

                      <td
                        className="
                          whitespace-nowrap
                          p-3
                          text-sm
                        "
                      >
                        {item.email ?? "-"}
                      </td>

                      {/* TEMPO */}

                      <td
                        className="
                          whitespace-nowrap
                          p-3
                          text-center
                        "
                      >

                        {renderTempo(
                          item.tempoDays
                        )}

                      </td>

                      {/* ACTION */}

                      <td className="p-3">

                        <div
                          className="
                            flex
                            justify-center
                            gap-2
                          "
                        >

                          {/* EDIT */}

                          <Link
                            href={`/supplier/${item.id}/edit`}
                            className="
                              flex
                              items-center
                              gap-1
                              rounded-lg
                              bg-[#F3EEDB]
                              px-3
                              py-2
                              text-xs
                              font-semibold
                              text-[#967C3E]
                              hover:opacity-90
                            "
                          >

                            <Pencil size={14} />

                            Edit

                          </Link>

                          {/* DELETE */}

                          <button
                            type="button"
                            onClick={() =>
                              hapusSupplier(
                                item.id
                              )
                            }
                            className="
                              flex
                              items-center
                              gap-1
                              rounded-lg
                              bg-[#F7E0DC]
                              px-3
                              py-2
                              text-xs
                              font-semibold
                              text-[#A45447]
                              hover:opacity-90
                            "
                          >

                            <Trash2 size={14} />

                            Hapus

                          </button>

                        </div>

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* =================================================
          IMPORT MODAL
      ================================================= */}

      <ImportSupplierModal
        open={openImport}
        onClose={() =>
          setOpenImport(false)
        }
        onSuccess={load}
      />

    </div>
  );
}