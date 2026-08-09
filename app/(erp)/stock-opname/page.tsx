"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Plus,
  RefreshCw,
  Eye,
  Trash2,
  Search,
  CheckCircle2,
  Clock3,
} from "lucide-react";

export default function StockOpnamePage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("SEMUA");

  // =================================
  // LOAD DATA
  // =================================

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch("/api/stock-opname", {
        cache: "no-store",
      });

      const json = await res.json();

      console.log("STOCK OPNAME LIST:", json);

      if (json.success) {
        setData(json.data ?? []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error("LOAD STOCK OPNAME ERROR:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // =================================
  // BUAT STOCK OPNAME
  // =================================

  async function buatOpname() {
    const ok = confirm(
      "Buat Stock Opname baru?\n\nSemua barang aktif akan dimasukkan ke dalam Stock Opname."
    );

    if (!ok) return;

    try {
      const res = await fetch("/api/stock-opname", {
        method: "POST",
      });

      const json = await res.json();

      console.log("CREATE STOCK OPNAME:", json);

      if (json.success) {
        alert("Stock Opname berhasil dibuat");
        await loadData();
      } else {
        alert(
          json.message || "Gagal membuat Stock Opname"
        );
      }
    } catch (error) {
      console.error("CREATE STOCK OPNAME ERROR:", error);

      alert("Gagal membuat Stock Opname");
    }
  }

  // =================================
  // HAPUS STOCK OPNAME
  // =================================

  async function hapusOpname(
    id: number,
    code: string
  ) {
    const ok = confirm(
      `Hapus Stock Opname ${code}?\n\nData item Stock Opname juga akan ikut dihapus.\n\nTindakan ini tidak dapat dibatalkan.`
    );

    if (!ok) return;

    try {
      setDeletingId(id);

      const res = await fetch(
        `/api/stock-opname/${id}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      console.log("DELETE STOCK OPNAME:", json);

      if (json.success) {
        alert("Stock Opname berhasil dihapus");
        await loadData();
      } else {
        alert(
          json.message ||
            "Gagal menghapus Stock Opname"
        );
      }
    } catch (error) {
      console.error(
        "DELETE STOCK OPNAME ERROR:",
        error
      );

      alert("Gagal menghapus Stock Opname");
    } finally {
      setDeletingId(null);
    }
  }

  // =================================
  // FILTER
  // =================================

  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return data.filter((item: any) => {
      const cocokSearch =
        !keyword ||
        String(item.code ?? "")
          .toLowerCase()
          .includes(keyword);

      const cocokStatus =
        status === "SEMUA" ||
        (status === "APPROVED" &&
          item.status === "APPROVED") ||
        (status === "COUNTING" &&
          item.status !== "APPROVED");

      return cocokSearch && cocokStatus;
    });
  }, [data, search, status]);

  // =================================
  // SUMMARY
  // =================================

  const totalOpname = data.length;

  const totalCounting = data.filter(
    (item: any) => item.status !== "APPROVED"
  ).length;

  const totalApproved = data.filter(
    (item: any) => item.status === "APPROVED"
  ).length;

  // =================================
  // RENDER
  // =================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* ================= HEADER ================= */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <div
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-xl
              bg-[#497F70]
              text-white
              shadow-sm
            "
          >
            <ClipboardCheck size={23} />
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
              Stock Opname
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Pemeriksaan dan penyesuaian stok fisik gudang
            </p>

          </div>

        </div>


        <button
          type="button"
          onClick={buatOpname}
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
            active:scale-[0.98]
          "
        >
          <Plus size={18} />
          Buat Opname
        </button>

      </div>


      {/* ================= SUMMARY ================= */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* TOTAL */}

        <div
          className="
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
          "
        >

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-500">
                Total Opname
              </p>

              <p className="mt-1 text-2xl font-bold text-[#18352D]">
                {totalOpname}
              </p>

            </div>

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-[#EAF3EF]
                text-[#497F70]
              "
            >
              <ClipboardCheck size={21} />
            </div>

          </div>

        </div>


        {/* COUNTING */}

        <div
          className="
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
          "
        >

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-500">
                Belum Disahkan
              </p>

              <p className="mt-1 text-2xl font-bold text-amber-600">
                {totalCounting}
              </p>

            </div>

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-amber-50
                text-amber-600
              "
            >
              <Clock3 size={21} />
            </div>

          </div>

        </div>


        {/* APPROVED */}

        <div
          className="
            rounded-2xl
            border
            border-[#DDE9E4]
            bg-white
            p-5
            shadow-sm
          "
        >

          <div className="flex items-center justify-between">

            <div>

              <p className="text-sm text-gray-500">
                Sudah Disahkan
              </p>

              <p className="mt-1 text-2xl font-bold text-green-600">
                {totalApproved}
              </p>

            </div>

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-green-50
                text-green-600
              "
            >
              <CheckCircle2 size={21} />
            </div>

          </div>

        </div>

      </div>


      {/* ================= CONTENT ================= */}

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

        {/* ================= TOOLBAR ================= */}

        <div className="border-b border-[#E5ECE9] p-4 md:p-5">

          <div
            className="
              flex
              flex-col
              gap-3
              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >

            {/* SEARCH */}

            <div className="relative w-full lg:max-w-md">

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
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Cari kode Stock Opname..."
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  py-2.5
                  pl-10
                  pr-4
                  text-sm
                  outline-none
                  transition
                  focus:border-[#497F70]
                  focus:ring-2
                  focus:ring-[#497F70]/10
                "
              />

            </div>


            {/* FILTER + REFRESH */}

            <div className="flex gap-2">

              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value)
                }
                className="
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  px-4
                  py-2.5
                  text-sm
                  outline-none
                  focus:border-[#497F70]
                "
              >

                <option value="SEMUA">
                  Semua Status
                </option>

                <option value="COUNTING">
                  Belum Disahkan
                </option>

                <option value="APPROVED">
                  Sudah Disahkan
                </option>

              </select>


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
                  border-[#D5E5DC]
                  bg-white
                  px-4
                  py-2.5
                  text-sm
                  font-medium
                  text-gray-700
                  transition
                  hover:bg-[#F5F8F6]
                  disabled:cursor-not-allowed
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


          {/* RESULT INFO */}

          <div className="mt-4 text-sm text-gray-500">

            Menampilkan{" "}

            <span className="font-semibold text-[#18352D]">
              {filteredData.length}
            </span>

            {" "}dari{" "}

            <span className="font-semibold text-[#18352D]">
              {data.length}
            </span>

            {" "}Stock Opname

          </div>

        </div>


        {/* ================= TABLE ================= */}

        <div className="overflow-x-auto">

          <table className="min-w-[900px] w-full text-sm">

            <thead className="bg-[#F5F8F6]">

              <tr className="border-b border-[#E5ECE9]">

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  No
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Kode
                </th>

                <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                  Tanggal
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Status
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Jumlah Item
                </th>

                <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                  Aksi
                </th>

              </tr>

            </thead>


            <tbody>

              {/* ================= LOADING ================= */}

              {loading ? (

                <tr>

                  <td
                    colSpan={6}
                    className="px-5 py-14 text-center"
                  >

                    <div className="flex flex-col items-center gap-3 text-gray-500">

                      <RefreshCw
                        size={24}
                        className="
                          animate-spin
                          text-[#497F70]
                        "
                      />

                      <span>
                        Memuat Stock Opname...
                      </span>

                    </div>

                  </td>

                </tr>

              ) : filteredData.length === 0 ? (

                /* ================= EMPTY ================= */

                <tr>

                  <td
                    colSpan={6}
                    className="px-5 py-14 text-center"
                  >

                    <div className="flex flex-col items-center">

                      <div
                        className="
                          mb-3
                          flex
                          h-14
                          w-14
                          items-center
                          justify-center
                          rounded-full
                          bg-[#EAF3EF]
                          text-[#497F70]
                        "
                      >
                        <ClipboardCheck size={25} />
                      </div>

                      <p className="font-semibold text-gray-700">
                        {search || status !== "SEMUA"
                          ? "Data Stock Opname tidak ditemukan"
                          : "Belum ada Stock Opname"}
                      </p>

                      <p className="mt-1 text-sm text-gray-400">
                        {search || status !== "SEMUA"
                          ? "Coba ubah pencarian atau filter."
                          : "Buat Stock Opname baru untuk mulai melakukan pemeriksaan stok."}
                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                /* ================= DATA ================= */

                filteredData.map(
                  (
                    item: any,
                    index: number
                  ) => {

                    const approved =
                      item.status === "APPROVED";

                    const deleting =
                      deletingId === item.id;

                    return (
                      <tr
                        key={item.id}
                        className="
                          border-b
                          border-[#EDF2EF]
                          transition
                          hover:bg-[#FAFCFB]
                        "
                      >

                        {/* NO */}

                        <td className="px-5 py-4 text-center text-gray-500">
                          {index + 1}
                        </td>


                        {/* KODE */}

                        <td className="px-5 py-4">

                          <div className="font-semibold text-[#18352D]">
                            {item.code || "-"}
                          </div>

                        </td>


                        {/* TANGGAL */}

                        <td className="px-5 py-4 whitespace-nowrap text-gray-600">

                          {item.date
                            ? new Date(
                                item.date
                              ).toLocaleDateString(
                                "id-ID",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                }
                              )
                            : "-"}

                        </td>


                        {/* STATUS */}

                        <td className="px-5 py-4 text-center">

                          {approved ? (

                            <span
                              className="
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-full
                                bg-green-50
                                px-3
                                py-1
                                text-xs
                                font-semibold
                                text-green-700
                              "
                            >

                              <span className="
                                h-1.5
                                w-1.5
                                rounded-full
                                bg-green-500
                              " />

                              APPROVED

                            </span>

                          ) : (

                            <span
                              className="
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-full
                                bg-amber-50
                                px-3
                                py-1
                                text-xs
                                font-semibold
                                text-amber-700
                              "
                            >

                              <span className="
                                h-1.5
                                w-1.5
                                rounded-full
                                bg-amber-500
                              " />

                              COUNTING

                            </span>

                          )}

                        </td>


                        {/* TOTAL ITEM */}

                        <td className="px-5 py-4 text-center font-medium text-gray-700">

                          {item.totalItem ?? 0}

                        </td>


                        {/* AKSI */}

                        <td className="px-5 py-4">

                          <div className="flex items-center justify-center gap-2">

                            <Link
                              href={`/stock-opname/${item.id}`}
                              className="
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-lg
                                bg-[#EAF3EF]
                                px-3
                                py-2
                                text-xs
                                font-semibold
                                text-[#497F70]
                                transition
                                hover:bg-[#DDEDE6]
                              "
                            >

                              <Eye size={14} />

                              Detail

                            </Link>


                            {!approved && (

                              <button
                                type="button"
                                disabled={deleting}
                                onClick={() =>
                                  hapusOpname(
                                    item.id,
                                    item.code
                                  )
                                }
                                className="
                                  inline-flex
                                  items-center
                                  gap-1.5
                                  rounded-lg
                                  bg-red-50
                                  px-3
                                  py-2
                                  text-xs
                                  font-semibold
                                  text-red-600
                                  transition
                                  hover:bg-red-100
                                  disabled:cursor-not-allowed
                                  disabled:opacity-50
                                "
                              >

                                <Trash2 size={14} />

                                {deleting
                                  ? "Menghapus..."
                                  : "Hapus"}

                              </button>

                            )}

                          </div>

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