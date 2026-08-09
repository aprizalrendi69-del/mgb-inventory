"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  RefreshCw,
  History,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  UserRound,
} from "lucide-react";

export default function HistoryPage() {
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // ==========================================
  // LOAD DATA
  // ==========================================

  async function loadData() {
    try {
      setLoading(true);

      const res = await fetch("/api/history", {
        cache: "no-store",
      });

      const result = await res.json();

      console.log("HISTORY:", result);

      if (result.success) {
        setData(result.data ?? []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error("LOAD HISTORY ERROR:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // ==========================================
  // FILTER
  // ==========================================

  const filteredData = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return data;
    }

    return data.filter((item: any) => {
      const type = String(
        item.transactionType ?? ""
      ).toLowerCase();

      const reference = String(
        item.reference ?? ""
      ).toLowerCase();

      const description = String(
        item.description ?? ""
      ).toLowerCase();

      const user = String(
        item.user?.fullname ?? ""
      ).toLowerCase();

      return (
        type.includes(keyword) ||
        reference.includes(keyword) ||
        description.includes(keyword) ||
        user.includes(keyword)
      );
    });
  }, [data, search]);

  // ==========================================
  // SUMMARY
  // ==========================================

  const totalHistory = data.length;

  const barangMasuk = data.filter((item: any) => {
    const type = String(
      item.transactionType ?? ""
    ).toUpperCase();

    return (
      type.includes("IN") ||
      type.includes("MASUK") ||
      type.includes("RECEIVE") ||
      type.includes("RECEIPT")
    );
  }).length;

  const barangKeluar = data.filter((item: any) => {
    const type = String(
      item.transactionType ?? ""
    ).toUpperCase();

    return (
      type.includes("OUT") ||
      type.includes("KELUAR") ||
      type.includes("DELIVERY") ||
      type.includes("ISSUE")
    );
  }).length;

  // ==========================================
  // FORMAT
  // ==========================================

  function formatDate(value: any) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatTime(value: any) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ==========================================
  // TRANSACTION STYLE
  // ==========================================

  function getTransactionStyle(type: any) {
    const value = String(type ?? "").toUpperCase();

    if (
      value.includes("IN") ||
      value.includes("MASUK") ||
      value.includes("RECEIVE") ||
      value.includes("RECEIPT")
    ) {
      return {
        label: type || "BARANG MASUK",
        className:
          "bg-emerald-50 text-emerald-700",
        dot: "bg-emerald-500",
        icon: ArrowDownToLine,
      };
    }

    if (
      value.includes("OUT") ||
      value.includes("KELUAR") ||
      value.includes("DELIVERY") ||
      value.includes("ISSUE")
    ) {
      return {
        label: type || "BARANG KELUAR",
        className:
          "bg-red-50 text-red-700",
        dot: "bg-red-500",
        icon: ArrowUpFromLine,
      };
    }

    return {
      label: type || "TRANSAKSI",
      className:
        "bg-blue-50 text-blue-700",
      dot: "bg-blue-500",
      icon: FileText,
    };
  }

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="space-y-6">

      {/* ======================================
          HEADER
      ====================================== */}

      <div className="
        flex
        flex-col
        gap-4
        md:flex-row
        md:items-center
        md:justify-between
      ">

        <div>

          <h1 className="
            text-2xl
            font-bold
            tracking-tight
            text-slate-800
          ">
            History Transaksi
          </h1>

          <p className="
            mt-1
            text-sm
            text-slate-500
          ">
            Riwayat seluruh aktivitas transaksi
            inventory dan gudang
          </p>

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
            border-slate-200
            bg-white
            px-4
            py-2.5
            text-sm
            font-medium
            text-slate-700
            shadow-sm
            transition
            hover:bg-slate-50
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

      </div>


      {/* ======================================
          SUMMARY
      ====================================== */}

      <div className="
        grid
        grid-cols-1
        gap-4
        sm:grid-cols-3
      ">

        {/* TOTAL */}

        <div className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-5
          shadow-sm
        ">

          <div className="
            flex
            items-center
            justify-between
          ">

            <div>

              <p className="
                text-sm
                font-medium
                text-slate-500
              ">
                Total Transaksi
              </p>

              <p className="
                mt-1
                text-2xl
                font-bold
                text-slate-800
              ">
                {totalHistory.toLocaleString("id-ID")}
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
              text-blue-600
            ">
              <History size={22} />
            </div>

          </div>

          <p className="
            mt-3
            text-xs
            text-slate-400
          ">
            Seluruh riwayat transaksi
          </p>

        </div>


        {/* BARANG MASUK */}

        <div className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-5
          shadow-sm
        ">

          <div className="
            flex
            items-center
            justify-between
          ">

            <div>

              <p className="
                text-sm
                font-medium
                text-slate-500
              ">
                Barang Masuk
              </p>

              <p className="
                mt-1
                text-2xl
                font-bold
                text-emerald-600
              ">
                {barangMasuk.toLocaleString("id-ID")}
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
              text-emerald-600
            ">
              <ArrowDownToLine size={22} />
            </div>

          </div>

          <p className="
            mt-3
            text-xs
            text-slate-400
          ">
            Aktivitas penambahan stock
          </p>

        </div>


        {/* BARANG KELUAR */}

        <div className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-5
          shadow-sm
        ">

          <div className="
            flex
            items-center
            justify-between
          ">

            <div>

              <p className="
                text-sm
                font-medium
                text-slate-500
              ">
                Barang Keluar
              </p>

              <p className="
                mt-1
                text-2xl
                font-bold
                text-red-600
              ">
                {barangKeluar.toLocaleString("id-ID")}
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
              text-red-600
            ">
              <ArrowUpFromLine size={22} />
            </div>

          </div>

          <p className="
            mt-3
            text-xs
            text-slate-400
          ">
            Aktivitas pengurangan stock
          </p>

        </div>

      </div>


      {/* ======================================
          SEARCH
      ====================================== */}

      <div className="
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-4
        shadow-sm
      ">

        <div className="
          flex
          flex-col
          gap-3
          md:flex-row
          md:items-center
          md:justify-between
        ">

          <div className="
            relative
            w-full
            md:max-w-xl
          ">

            <Search
              size={19}
              className="
                absolute
                left-3
                top-1/2
                -translate-y-1/2
                text-slate-400
              "
            />

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="
                Cari jenis, referensi,
                keterangan, atau user...
              "
              className="
                w-full
                rounded-xl
                border
                border-slate-200
                bg-slate-50
                py-3
                pl-10
                pr-10
                text-sm
                text-slate-700
                outline-none
                transition
                placeholder:text-slate-400
                focus:border-emerald-500
                focus:bg-white
                focus:ring-2
                focus:ring-emerald-100
              "
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="
                  absolute
                  right-3
                  top-1/2
                  -translate-y-1/2
                  rounded-lg
                  p-1
                  text-slate-400
                  transition
                  hover:bg-slate-100
                  hover:text-slate-600
                "
                title="Hapus pencarian"
              >
                <X size={17} />
              </button>
            )}

          </div>


          <div className="
            text-xs
            text-slate-500
          ">

            {search
              ? `Menampilkan ${filteredData.length} dari ${data.length} transaksi`
              : `${data.length} transaksi dalam history`}

          </div>

        </div>

      </div>


      {/* ======================================
          TABLE
      ====================================== */}

      <div className="
        overflow-hidden
        rounded-2xl
        border
        border-slate-200
        bg-white
        shadow-sm
      ">

        <div className="overflow-x-auto">

          <table className="
            min-w-[1050px]
            w-full
            text-sm
          ">

            <thead className="
              border-b
              border-slate-200
              bg-slate-50
            ">

              <tr>

                <th className="
                  whitespace-nowrap
                  px-4
                  py-3
                  text-center
                  font-semibold
                  text-slate-600
                ">
                  No
                </th>

                <th className="
                  whitespace-nowrap
                  px-4
                  py-3
                  text-left
                  font-semibold
                  text-slate-600
                ">
                  Tanggal
                </th>

                <th className="
                  whitespace-nowrap
                  px-4
                  py-3
                  text-left
                  font-semibold
                  text-slate-600
                ">
                  Jenis Transaksi
                </th>

                <th className="
                  whitespace-nowrap
                  px-4
                  py-3
                  text-left
                  font-semibold
                  text-slate-600
                ">
                  Referensi
                </th>

                <th className="
                  whitespace-nowrap
                  px-4
                  py-3
                  text-left
                  font-semibold
                  text-slate-600
                ">
                  Keterangan
                </th>

                <th className="
                  whitespace-nowrap
                  px-4
                  py-3
                  text-left
                  font-semibold
                  text-slate-600
                ">
                  User
                </th>

              </tr>

            </thead>


            <tbody>

              {/* LOADING */}

              {loading && (
                <tr>

                  <td
                    colSpan={6}
                    className="px-4 py-14 text-center"
                  >

                    <div className="
                      flex
                      flex-col
                      items-center
                      justify-center
                      gap-3
                    ">

                      <RefreshCw
                        size={25}
                        className="
                          animate-spin
                          text-emerald-600
                        "
                      />

                      <span className="
                        text-sm
                        text-slate-500
                      ">
                        Memuat history transaksi...
                      </span>

                    </div>

                  </td>

                </tr>
              )}


              {/* EMPTY */}

              {!loading &&
                filteredData.length === 0 && (
                  <tr>

                    <td
                      colSpan={6}
                      className="px-4 py-14 text-center"
                    >

                      <div className="
                        flex
                        flex-col
                        items-center
                      ">

                        <div className="
                          flex
                          h-14
                          w-14
                          items-center
                          justify-center
                          rounded-2xl
                          bg-slate-100
                          text-slate-400
                        ">

                          <History size={28} />

                        </div>

                        <p className="
                          mt-4
                          font-medium
                          text-slate-700
                        ">
                          {search
                            ? "History tidak ditemukan"
                            : "Belum ada history transaksi"}
                        </p>

                        <p className="
                          mt-1
                          text-xs
                          text-slate-400
                        ">
                          {search
                            ? "Coba gunakan kata kunci yang berbeda."
                            : "Aktivitas transaksi akan tampil di sini."}
                        </p>

                      </div>

                    </td>

                  </tr>
                )}


              {/* DATA */}

              {!loading &&
                filteredData.map(
                  (
                    item: any,
                    index: number
                  ) => {

                    const transaction =
                      getTransactionStyle(
                        item.transactionType
                      );

                    const TransactionIcon =
                      transaction.icon;

                    return (
                      <tr
                        key={item.id}
                        className="
                          border-b
                          border-slate-100
                          transition
                          hover:bg-slate-50
                        "
                      >

                        {/* NO */}

                        <td className="
                          whitespace-nowrap
                          px-4
                          py-3
                          text-center
                          text-slate-400
                        ">
                          {index + 1}
                        </td>


                        {/* TANGGAL */}

                        <td className="
                          whitespace-nowrap
                          px-4
                          py-3
                        ">

                          <div className="
                            font-medium
                            text-slate-700
                          ">
                            {formatDate(
                              item.createdAt
                            )}
                          </div>

                          <div className="
                            mt-0.5
                            text-xs
                            text-slate-400
                          ">
                            {formatTime(
                              item.createdAt
                            )}
                          </div>

                        </td>


                        {/* JENIS */}

                        <td className="
                          whitespace-nowrap
                          px-4
                          py-3
                        ">

                          <span
                            className={`
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-full
                              px-3
                              py-1
                              text-xs
                              font-semibold
                              ${transaction.className}
                            `}
                          >

                            <span
                              className={`
                                flex
                                h-5
                                w-5
                                items-center
                                justify-center
                                rounded-full
                                bg-white/70
                              `}
                            >
                              <TransactionIcon
                                size={12}
                              />
                            </span>

                            {transaction.label}

                          </span>

                        </td>


                        {/* REFERENSI */}

                        <td className="
                          whitespace-nowrap
                          px-4
                          py-3
                          font-medium
                          text-slate-700
                        ">

                          {item.reference || "-"}

                        </td>


                        {/* KETERANGAN */}

                        <td className="
                          max-w-[350px]
                          px-4
                          py-3
                          text-slate-600
                        ">

                          <div className="
                            line-clamp-2
                          ">
                            {item.description || "-"}
                          </div>

                        </td>


                        {/* USER */}

                        <td className="
                          whitespace-nowrap
                          px-4
                          py-3
                        ">

                          <div className="
                            flex
                            items-center
                            gap-2
                          ">

                            <div className="
                              flex
                              h-8
                              w-8
                              items-center
                              justify-center
                              rounded-lg
                              bg-slate-100
                              text-slate-500
                            ">
                              <UserRound size={15} />
                            </div>

                            <span className="
                              font-medium
                              text-slate-700
                            ">
                              {item.user?.fullname ||
                                item.user?.username ||
                                "-"}
                            </span>

                          </div>

                        </td>

                      </tr>
                    );
                  }
                )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}