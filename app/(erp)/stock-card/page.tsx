"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock3,
  RefreshCw,
  Search,
  X,
  History as HistoryIcon,
} from "lucide-react";

export default function HistoryPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // ==========================================
  // LOAD DATA
  // ==========================================

  async function load() {
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
    load();
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
      type.includes("DELIVERY")
    );
  }).length;

  const aktivitasLain = Math.max(
    totalHistory - barangMasuk - barangKeluar,
    0
  );

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

  function getTransactionType(item: any) {
    return String(
      item.transactionType ?? ""
    ).toUpperCase();
  }

  function isIncoming(item: any) {
    const type = getTransactionType(item);

    return (
      type.includes("IN") ||
      type.includes("MASUK") ||
      type.includes("RECEIVE") ||
      type.includes("RECEIPT")
    );
  }

  function isOutgoing(item: any) {
    const type = getTransactionType(item);

    return (
      type.includes("OUT") ||
      type.includes("KELUAR") ||
      type.includes("DELIVERY")
    );
  }

  function getTransactionLabel(item: any) {
    const type = getTransactionType(item);

    if (
      type.includes("RECEIVE") ||
      type.includes("RECEIPT")
    ) {
      return "Barang Masuk";
    }

    if (
      type.includes("DELIVERY") ||
      type.includes("OUT")
    ) {
      return "Barang Keluar";
    }

    if (type.includes("MASUK")) {
      return "Barang Masuk";
    }

    if (type.includes("KELUAR")) {
      return "Barang Keluar";
    }

    return item.transactionType || "Transaksi";
  }

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* ======================================
          HEADER
      ====================================== */}

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <div className="
            flex
            h-12
            w-12
            items-center
            justify-center
            rounded-xl
            bg-[#497F70]
            text-white
            shadow-sm
          ">
            <HistoryIcon size={23} />
          </div>

          <div>

            <h1 className="
              text-2xl
              font-bold
              tracking-tight
              text-[#18352D]
              md:text-3xl
            ">
              History Transaksi
            </h1>

            <p className="
              mt-1
              text-sm
              text-gray-500
            ">
              Riwayat aktivitas dan transaksi inventory
            </p>

          </div>

        </div>


        {/* REFRESH */}

        <button
          type="button"
          onClick={load}
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

      </div>


      {/* ======================================
          SUMMARY
      ====================================== */}

      <div className="
        mb-6
        grid
        grid-cols-1
        gap-4
        sm:grid-cols-2
        lg:grid-cols-4
      ">

        {/* TOTAL */}

        <div className="
          rounded-2xl
          border
          border-[#DDE9E4]
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
                text-gray-500
              ">
                Total History
              </p>

              <p className="
                mt-1
                text-2xl
                font-bold
                text-[#18352D]
              ">
                {totalHistory}
              </p>

            </div>

            <div className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-[#EAF3EF]
              text-[#497F70]
            ">
              <Activity size={21} />
            </div>

          </div>

          <p className="
            mt-3
            text-xs
            text-gray-400
          ">
            Seluruh aktivitas transaksi
          </p>

        </div>


        {/* BARANG MASUK */}

        <div className="
          rounded-2xl
          border
          border-[#DDE9E4]
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
                text-gray-500
              ">
                Barang Masuk
              </p>

              <p className="
                mt-1
                text-2xl
                font-bold
                text-green-600
              ">
                {barangMasuk}
              </p>

            </div>

            <div className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-green-50
              text-green-600
            ">
              <ArrowDownToLine size={21} />
            </div>

          </div>

          <p className="
            mt-3
            text-xs
            text-gray-400
          ">
            Transaksi penerimaan barang
          </p>

        </div>


        {/* BARANG KELUAR */}

        <div className="
          rounded-2xl
          border
          border-[#DDE9E4]
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
                text-gray-500
              ">
                Barang Keluar
              </p>

              <p className="
                mt-1
                text-2xl
                font-bold
                text-red-600
              ">
                {barangKeluar}
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
              <ArrowUpFromLine size={21} />
            </div>

          </div>

          <p className="
            mt-3
            text-xs
            text-gray-400
          ">
            Transaksi pengeluaran barang
          </p>

        </div>


        {/* AKTIVITAS LAIN */}

        <div className="
          rounded-2xl
          border
          border-[#DDE9E4]
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
                text-gray-500
              ">
                Aktivitas Lain
              </p>

              <p className="
                mt-1
                text-2xl
                font-bold
                text-[#497F70]
              ">
                {aktivitasLain}
              </p>

            </div>

            <div className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-[#EAF3EF]
              text-[#497F70]
            ">
              <Clock3 size={21} />
            </div>

          </div>

          <p className="
            mt-3
            text-xs
            text-gray-400
          ">
            Aktivitas inventory lainnya
          </p>

        </div>

      </div>


      {/* ======================================
          TABLE CONTAINER
      ====================================== */}

      <div className="
        overflow-hidden
        rounded-2xl
        border
        border-[#DDE9E4]
        bg-white
        shadow-sm
      ">

        {/* ====================================
            TOOLBAR
        ==================================== */}

        <div className="
          border-b
          border-[#E5ECE9]
          p-4
          md:p-5
        ">

          <div className="
            flex
            flex-col
            gap-3
            md:flex-row
            md:items-center
            md:justify-between
          ">

            {/* SEARCH */}

            <div className="
              relative
              w-full
              md:max-w-xl
            ">

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
                placeholder="
                  Cari jenis transaksi, referensi,
                  keterangan, atau user...
                "
                className="
                  w-full
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-[#FAFCFB]
                  py-2.5
                  pl-10
                  pr-10
                  text-sm
                  text-gray-700
                  outline-none
                  transition
                  placeholder:text-gray-400
                  focus:border-[#497F70]
                  focus:bg-white
                  focus:ring-2
                  focus:ring-[#497F70]/10
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
                    text-gray-400
                    transition
                    hover:bg-[#EAF3EF]
                    hover:text-[#497F70]
                  "
                  title="Hapus pencarian"
                >
                  <X size={16} />
                </button>
              )}

            </div>


            {/* RESULT */}

            <div className="
              text-sm
              text-gray-500
            ">

              Menampilkan{" "}

              <span className="
                font-semibold
                text-[#18352D]
              ">
                {filteredData.length}
              </span>

              {" "}dari{" "}

              <span className="
                font-semibold
                text-[#18352D]
              ">
                {data.length}
              </span>

              {" "}transaksi

            </div>

          </div>

        </div>


        {/* ====================================
            TABLE
        ==================================== */}

        <div className="overflow-x-auto">

          <table className="
            min-w-[1050px]
            w-full
            text-sm
          ">

            <thead className="
              bg-[#F5F8F6]
            ">

              <tr className="
                border-b
                border-[#E5ECE9]
              ">

                <th className="
                  px-5
                  py-4
                  text-center
                  font-semibold
                  text-[#35564C]
                ">
                  No
                </th>

                <th className="
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-[#35564C]
                ">
                  Tanggal
                </th>

                <th className="
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-[#35564C]
                ">
                  Jenis
                </th>

                <th className="
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-[#35564C]
                ">
                  Referensi
                </th>

                <th className="
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-[#35564C]
                ">
                  Keterangan
                </th>

                <th className="
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-[#35564C]
                ">
                  User
                </th>

              </tr>

            </thead>


            <tbody>

              {/* =================================
                  LOADING
              ================================= */}

              {loading && (
                <tr>

                  <td
                    colSpan={6}
                    className="
                      px-5
                      py-14
                      text-center
                    "
                  >

                    <div className="
                      flex
                      flex-col
                      items-center
                      gap-3
                      text-gray-500
                    ">

                      <RefreshCw
                        size={24}
                        className="
                          animate-spin
                          text-[#497F70]
                        "
                      />

                      <span>
                        Memuat History Transaksi...
                      </span>

                    </div>

                  </td>

                </tr>
              )}


              {/* =================================
                  EMPTY
              ================================= */}

              {!loading &&
                filteredData.length === 0 && (
                  <tr>

                    <td
                      colSpan={6}
                      className="
                        px-5
                        py-14
                        text-center
                      "
                    >

                      <div className="
                        flex
                        flex-col
                        items-center
                      ">

                        <div className="
                          mb-3
                          flex
                          h-14
                          w-14
                          items-center
                          justify-center
                          rounded-full
                          bg-[#EAF3EF]
                          text-[#497F70]
                        ">

                          <HistoryIcon size={25} />

                        </div>

                        <p className="
                          font-semibold
                          text-gray-700
                        ">

                          {search
                            ? "Data tidak ditemukan"
                            : "Belum ada history transaksi"}

                        </p>

                        <p className="
                          mt-1
                          text-sm
                          text-gray-400
                        ">

                          {search
                            ? "Coba gunakan kata pencarian yang berbeda."
                            : "Riwayat aktivitas transaksi akan muncul di sini."}

                        </p>

                      </div>

                    </td>

                  </tr>
                )}


              {/* =================================
                  DATA
              ================================= */}

              {!loading &&
                filteredData.map(
                  (
                    item: any,
                    index: number
                  ) => {

                    const incoming =
                      isIncoming(item);

                    const outgoing =
                      isOutgoing(item);

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

                        <td className="
                          px-5
                          py-4
                          text-center
                          text-gray-500
                        ">
                          {index + 1}
                        </td>


                        {/* TANGGAL */}

                        <td className="
                          whitespace-nowrap
                          px-5
                          py-4
                        ">

                          <div className="
                            font-medium
                            text-gray-700
                          ">
                            {formatDate(
                              item.createdAt
                            )}
                          </div>

                          {formatTime(
                            item.createdAt
                          ) && (
                            <div className="
                              mt-0.5
                              text-xs
                              text-gray-400
                            ">
                              {formatTime(
                                item.createdAt
                              )}
                            </div>
                          )}

                        </td>


                        {/* JENIS */}

                        <td className="px-5 py-4">

                          {incoming ? (

                            <span className="
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
                            ">

                              <ArrowDownToLine
                                size={13}
                              />

                              {getTransactionLabel(
                                item
                              )}

                            </span>

                          ) : outgoing ? (

                            <span className="
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-full
                              bg-red-50
                              px-3
                              py-1
                              text-xs
                              font-semibold
                              text-red-600
                            ">

                              <ArrowUpFromLine
                                size={13}
                              />

                              {getTransactionLabel(
                                item
                              )}

                            </span>

                          ) : (

                            <span className="
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-full
                              bg-[#EAF3EF]
                              px-3
                              py-1
                              text-xs
                              font-semibold
                              text-[#497F70]
                            ">

                              <Activity
                                size={13}
                              />

                              {getTransactionLabel(
                                item
                              )}

                            </span>

                          )}

                        </td>


                        {/* REFERENSI */}

                        <td className="
                          px-5
                          py-4
                        ">

                          <span className="
                            font-medium
                            text-[#18352D]
                          ">
                            {item.reference || "-"}
                          </span>

                        </td>


                        {/* KETERANGAN */}

                        <td className="
                          max-w-[400px]
                          px-5
                          py-4
                        ">

                          <div className="
                            truncate
                            text-gray-600
                          ">
                            {item.description || "-"}
                          </div>

                        </td>


                        {/* USER */}

                        <td className="
                          whitespace-nowrap
                          px-5
                          py-4
                        ">

                          <div className="
                            font-medium
                            text-gray-700
                          ">
                            {item.user?.fullname ||
                              "-"}
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