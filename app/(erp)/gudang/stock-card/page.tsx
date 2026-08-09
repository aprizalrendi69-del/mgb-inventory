"use client";

import { useEffect, useState } from "react";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Package,
  RefreshCw,
} from "lucide-react";

export default function StockCardPage() {
  const [barang, setBarang] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [data, setData] = useState<any>(null);

  const [loadingBarang, setLoadingBarang] = useState(true);
  const [loading, setLoading] = useState(false);

  // ==========================================
  // LOAD BARANG
  // ==========================================

  async function loadBarang() {
    try {
      setLoadingBarang(true);

      const res = await fetch("/api/barang", {
        cache: "no-store",
      });

      const json = await res.json();

      console.log("BARANG:", json);

      setBarang(
        Array.isArray(json)
          ? json
          : json.data || []
      );
    } catch (error) {
      console.error(
        "LOAD BARANG ERROR:",
        error
      );

      setBarang([]);
    } finally {
      setLoadingBarang(false);
    }
  }

  // ==========================================
  // LOAD STOCK CARD
  // ==========================================

  async function loadCard() {
    if (!selected) {
      alert("Silakan pilih barang terlebih dahulu.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
        `/api/stock-card/${selected}`,
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      console.log(
        "STOCK CARD DETAIL:",
        json
      );

      if (json.success) {
        setData(json.data);
      } else {
        setData(null);

        alert(
          json.message ||
            "Gagal mengambil kartu stok."
        );
      }
    } catch (error) {
      console.error(
        "LOAD STOCK CARD ERROR:",
        error
      );

      setData(null);

      alert(
        "Gagal mengambil kartu stok."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // INITIAL LOAD
  // ==========================================

  useEffect(() => {
    loadBarang();
  }, []);

  // ==========================================
  // FORMAT
  // ==========================================

  function formatNumber(value: any) {
    return Number(value ?? 0).toLocaleString(
      "id-ID"
    );
  }

  function formatDate(value: any) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  // ==========================================
  // DATA
  // ==========================================

  const stockCard =
    data?.stockCard ?? [];

  const selectedBarang =
    data?.barang ?? null;

  // ==========================================
  // SUMMARY
  // ==========================================

  const totalTransaksi =
    stockCard.length;

  const totalMasuk =
    stockCard.reduce(
      (total: number, item: any) =>
        total +
        Number(item.qtyIn ?? 0),
      0
    );

  const totalKeluar =
    stockCard.reduce(
      (total: number, item: any) =>
        total +
        Number(item.qtyOut ?? 0),
      0
    );

  const currentStock =
    Number(
      selectedBarang?.stock ?? 0
    );

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* ======================================
          HEADER
      ====================================== */}

      <div className="
        mb-7
        flex
        flex-col
        gap-4
        md:flex-row
        md:items-center
        md:justify-between
      ">

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

            <Boxes size={23} />

          </div>

          <div>

            <h1 className="
              text-2xl
              font-bold
              tracking-tight
              text-[#18352D]
              md:text-3xl
            ">
              Kartu Stok
            </h1>

            <p className="
              mt-1
              text-sm
              text-gray-500
            ">
              Riwayat pergerakan dan saldo stok barang
            </p>

          </div>

        </div>

        <button
          type="button"
          onClick={() => {
            loadBarang();

            if (selected) {
              loadCard();
            }
          }}
          disabled={
            loading ||
            loadingBarang
          }
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
              loading ||
              loadingBarang
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

      {data && (
        <div className="
          mb-6
          grid
          grid-cols-1
          gap-4
          sm:grid-cols-2
          lg:grid-cols-4
        ">

          {/* STOCK SEKARANG */}

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
                  Stock Sekarang
                </p>

                <p className="
                  mt-1
                  text-2xl
                  font-bold
                  text-[#18352D]
                ">
                  {formatNumber(
                    currentStock
                  )}
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

                <Package size={21} />

              </div>

            </div>

          </div>


          {/* TRANSAKSI */}

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
                  Total Transaksi
                </p>

                <p className="
                  mt-1
                  text-2xl
                  font-bold
                  text-[#18352D]
                ">
                  {formatNumber(
                    totalTransaksi
                  )}
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

                <Boxes size={21} />

              </div>

            </div>

          </div>


          {/* TOTAL MASUK */}

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
                  Total Barang Masuk
                </p>

                <p className="
                  mt-1
                  text-2xl
                  font-bold
                  text-green-600
                ">
                  +{formatNumber(totalMasuk)}
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

                <ArrowDownToLine
                  size={21}
                />

              </div>

            </div>

          </div>


          {/* TOTAL KELUAR */}

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
                  Total Barang Keluar
                </p>

                <p className="
                  mt-1
                  text-2xl
                  font-bold
                  text-red-600
                ">
                  -{formatNumber(totalKeluar)}
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

                <ArrowUpFromLine
                  size={21}
                />

              </div>

            </div>

          </div>

        </div>
      )}


      {/* ======================================
          PILIH BARANG
      ====================================== */}

      <div className="
        mb-6
        rounded-2xl
        border
        border-[#DDE9E4]
        bg-white
        p-5
        shadow-sm
      ">

        <div className="
          mb-3
          flex
          items-center
          gap-2
        ">

          <Package
            size={18}
            className="text-[#497F70]"
          />

          <h2 className="
            text-sm
            font-semibold
            text-[#18352D]
          ">
            Pilih Barang
          </h2>

        </div>

        <div className="
          flex
          flex-col
          gap-3
          md:flex-row
          md:items-center
        ">

          <select
            className="
              w-full
              rounded-xl
              border
              border-[#D5E5DC]
              bg-[#FAFCFB]
              px-4
              py-3
              text-sm
              text-gray-700
              outline-none
              transition
              focus:border-[#497F70]
              focus:bg-white
              focus:ring-2
              focus:ring-[#497F70]/10
              md:flex-1
            "
            value={selected}
            onChange={(e) => {
              setSelected(
                e.target.value
              );

              setData(null);
            }}
            disabled={loadingBarang}
          >

            <option value="">
              {loadingBarang
                ? "Memuat barang..."
                : "-- Pilih Barang --"}
            </option>

            {barang.map(
              (b: any) => (
                <option
                  key={b.id}
                  value={b.id}
                >
                  {b.code} - {b.name}
                </option>
              )
            )}

          </select>


          <button
            type="button"
            onClick={loadCard}
            disabled={
              !selected ||
              loading
            }
            className="
              inline-flex
              min-w-[140px]
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
              hover:bg-[#3E6E61]
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >

            {loading ? (
              <>
                <RefreshCw
                  size={17}
                  className="animate-spin"
                />

                Memuat...
              </>
            ) : (
              <>
                <Boxes size={17} />

                Tampilkan
              </>
            )}

          </button>

        </div>

      </div>


      {/* ======================================
          DETAIL BARANG
      ====================================== */}

      {data && (
        <div className="
          mb-6
          rounded-2xl
          border
          border-[#DDE9E4]
          bg-white
          p-5
          shadow-sm
        ">

          <div className="
            flex
            flex-col
            gap-4
            md:flex-row
            md:items-center
            md:justify-between
          ">

            <div>

              <p className="
                text-xs
                font-medium
                uppercase
                tracking-wide
                text-gray-400
              ">
                Barang Terpilih
              </p>

              <h2 className="
                mt-1
                text-xl
                font-bold
                text-[#18352D]
              ">
                {selectedBarang?.name ||
                  "-"}
              </h2>

              <div className="
                mt-1
                flex
                flex-wrap
                gap-2
                text-sm
                text-gray-500
              ">

                <span>
                  Kode:{" "}
                  <span className="font-medium">
                    {selectedBarang?.code ||
                      "-"}
                  </span>
                </span>

                <span>•</span>

                <span>
                  Satuan:{" "}
                  <span className="font-medium">
                    {selectedBarang?.unit ||
                      "-"}
                  </span>
                </span>

              </div>

            </div>


            <div className="
              rounded-xl
              bg-[#EAF3EF]
              px-5
              py-3
              text-right
            ">

              <p className="
                text-xs
                text-[#497F70]
              ">
                Stock Saat Ini
              </p>

              <p className="
                mt-0.5
                text-xl
                font-bold
                text-[#18352D]
              ">
                {formatNumber(
                  currentStock
                )}
              </p>

            </div>

          </div>

        </div>
      )}


      {/* ======================================
          TABLE
      ====================================== */}

      {data && (
        <div className="
          overflow-hidden
          rounded-2xl
          border
          border-[#DDE9E4]
          bg-white
          shadow-sm
        ">

          <div className="
            border-b
            border-[#E5ECE9]
            px-5
            py-4
          ">

            <div className="
              flex
              items-center
              justify-between
            ">

              <div>

                <h2 className="
                  font-semibold
                  text-[#18352D]
                ">
                  Riwayat Pergerakan Stok
                </h2>

                <p className="
                  mt-0.5
                  text-xs
                  text-gray-400
                ">
                  Detail transaksi dan saldo stok
                </p>

              </div>

              <span className="
                rounded-full
                bg-[#EAF3EF]
                px-3
                py-1
                text-xs
                font-semibold
                text-[#497F70]
              ">
                {formatNumber(
                  totalTransaksi
                )} transaksi
              </span>

            </div>

          </div>


          <div className="overflow-x-auto">

            <table className="
              min-w-[900px]
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
                    Transaksi
                  </th>

                  <th className="
                    px-5
                    py-4
                    text-right
                    font-semibold
                    text-[#35564C]
                  ">
                    Qty Masuk
                  </th>

                  <th className="
                    px-5
                    py-4
                    text-right
                    font-semibold
                    text-[#35564C]
                  ">
                    Qty Keluar
                  </th>

                  <th className="
                    px-5
                    py-4
                    text-right
                    font-semibold
                    text-[#35564C]
                  ">
                    Balance
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

                </tr>

              </thead>


              <tbody>

                {stockCard.length === 0 ? (

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
                          flex
                          h-14
                          w-14
                          items-center
                          justify-center
                          rounded-full
                          bg-[#EAF3EF]
                          text-[#497F70]
                        ">

                          <Boxes size={25} />

                        </div>

                        <p className="
                          mt-4
                          font-semibold
                          text-gray-700
                        ">
                          Belum ada transaksi
                        </p>

                        <p className="
                          mt-1
                          text-sm
                          text-gray-400
                        ">
                          Riwayat pergerakan stok barang
                          akan muncul di sini.
                        </p>

                      </div>

                    </td>

                  </tr>

                ) : (

                  stockCard.map(
                    (
                      item: any,
                      index: number
                    ) => {

                      const qtyIn =
                        Number(
                          item.qtyIn ?? 0
                        );

                      const qtyOut =
                        Number(
                          item.qtyOut ?? 0
                        );

                      const balance =
                        Number(
                          item.balance ?? 0
                        );

                      const type =
                        String(
                          item.trxType ??
                          ""
                        ).toUpperCase();

                      const isIn =
                        qtyIn > 0 ||
                        type === "IN" ||
                        type.includes(
                          "MASUK"
                        );

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

                          {/* TANGGAL */}

                          <td className="
                            whitespace-nowrap
                            px-5
                            py-4
                            text-gray-600
                          ">
                            {formatDate(
                              item.trxDate
                            )}
                          </td>


                          {/* TRANSAKSI */}

                          <td className="
                            px-5
                            py-4
                          ">

                            {isIn ? (

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

                                {item.trxType ||
                                  "Barang Masuk"}

                              </span>

                            ) : (

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

                                {item.trxType ||
                                  "Barang Keluar"}

                              </span>

                            )}

                          </td>


                          {/* QTY MASUK */}

                          <td className="
                            whitespace-nowrap
                            px-5
                            py-4
                            text-right
                            font-semibold
                          ">

                            {qtyIn > 0 ? (

                              <span className="
                                text-green-600
                              ">
                                +{formatNumber(
                                  qtyIn
                                )}
                              </span>

                            ) : (

                              <span className="
                                text-gray-300
                              ">
                                -
                              </span>

                            )}

                          </td>


                          {/* QTY KELUAR */}

                          <td className="
                            whitespace-nowrap
                            px-5
                            py-4
                            text-right
                            font-semibold
                          ">

                            {qtyOut > 0 ? (

                              <span className="
                                text-red-600
                              ">
                                -{formatNumber(
                                  qtyOut
                                )}
                              </span>

                            ) : (

                              <span className="
                                text-gray-300
                              ">
                                -
                              </span>

                            )}

                          </td>


                          {/* BALANCE */}

                          <td className="
                            whitespace-nowrap
                            px-5
                            py-4
                            text-right
                          ">

                            <span className="
                              inline-flex
                              min-w-[80px]
                              justify-end
                              rounded-lg
                              bg-[#EAF3EF]
                              px-3
                              py-1.5
                              font-bold
                              text-[#18352D]
                            ">
                              {formatNumber(
                                balance
                              )}
                            </span>

                          </td>


                          {/* KETERANGAN */}

                          <td className="
                            px-5
                            py-4
                            text-gray-600
                          ">
                            {item.note ||
                              "-"}
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
      )}


      {/* ======================================
          EMPTY STATE SEBELUM PILIH BARANG
      ====================================== */}

      {!data && (
        <div className="
          rounded-2xl
          border
          border-[#DDE9E4]
          bg-white
          p-12
          text-center
          shadow-sm
        ">

          <div className="
            mx-auto
            flex
            h-16
            w-16
            items-center
            justify-center
            rounded-2xl
            bg-[#EAF3EF]
            text-[#497F70]
          ">

            <Boxes size={30} />

          </div>

          <h2 className="
            mt-4
            font-semibold
            text-[#18352D]
          ">
            Pilih barang untuk melihat Kartu Stok
          </h2>

          <p className="
            mt-1
            text-sm
            text-gray-400
          ">
            Pilih barang pada bagian di atas,
            kemudian klik Tampilkan.
          </p>

        </div>
      )}

    </div>
  );
}