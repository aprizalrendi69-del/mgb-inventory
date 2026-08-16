"use client";

import { useEffect, useState } from "react";
import {
  PackageCheck,
  ShoppingCart,
  CalendarDays,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export default function BarangMasukPage() {
  const [purchase, setPurchase] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  const [qty, setQty] = useState<Record<number, number>>({});
  const [expired, setExpired] = useState<Record<number, string>>({});

  const [loading, setLoading] = useState(false);
  const [loadingPurchase, setLoadingPurchase] = useState(true);

  // ==========================================
  // LOAD PURCHASE ORDER
  // ==========================================

  async function loadPurchase() {
    try {
      setLoadingPurchase(true);

      const res = await fetch("/api/purchase", {
        cache: "no-store",
      });

      const json = await res.json();

      const purchases = Array.isArray(json)
        ? json
        : json.data ?? [];

      // BARANG MASUK PUSAT:
      // hanya PO PUSAT yang sudah APPROVED
      const approved = purchases.filter(
        (p: any) =>
          p.status === "APPROVED" &&
          p.source === "PUSAT"
      );

      setPurchase(approved);
    } catch (error) {
      console.error("LOAD PURCHASE ERROR:", error);
      setPurchase([]);
    } finally {
      setLoadingPurchase(false);
    }
  }

  useEffect(() => {
    loadPurchase();
  }, []);

  // ==========================================
  // PILIH PO
  // ==========================================

  function pilihPO(po: any) {
    setSelected(po);

    const newQty: Record<number, number> = {};
    const newExpired: Record<number, string> = {};

    po.items?.forEach((item: any) => {
      newQty[item.barangId] = Number(item.qty ?? 0);
      newExpired[item.barangId] = "";
    });

    setQty(newQty);
    setExpired(newExpired);
  }

  // ==========================================
  // TERIMA BARANG
  // ==========================================

  async function receive() {
    if (!selected) {
      alert("Pilih Purchase Order terlebih dahulu");
      return;
    }

    const invalidQty = selected.items.some(
      (item: any) =>
        Number(qty[item.barangId] ?? 0) <= 0
    );

    if (invalidQty) {
      alert("Qty barang harus lebih dari 0");
      return;
    }

    setLoading(true);

    try {
      const items = selected.items.map(
        (item: any) => ({
          barangId: item.barangId,
          qty: Number(
            qty[item.barangId] ?? 0
          ),
          price: Number(item.price ?? 0),
          expiredDate:
            expired[item.barangId] || null,
        })
      );

      const res = await fetch(
        "/api/goods-receipt",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            purchaseId: selected.id,
            items,
          }),
        }
      );

      const json = await res.json();

      if (json.success) {
        alert(
          json.message ??
            "Barang berhasil diterima"
        );

        setSelected(null);
        setQty({});
        setExpired({});

        await loadPurchase();
      } else {
        alert(
          json.message ??
            "Gagal menerima barang"
        );
      }
    } catch (error) {
      console.error(
        "RECEIVE BARANG ERROR:",
        error
      );

      alert("Terjadi kesalahan saat menerima barang");
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // UPDATE QTY
  // ==========================================

  function updateQty(
    barangId: number,
    value: string
  ) {
    setQty((prev) => ({
      ...prev,
      [barangId]:
        value === ""
          ? 0
          : Number(value),
    }));
  }

  // ==========================================
  // UPDATE EXPIRED
  // ==========================================

  function updateExpired(
    barangId: number,
    value: string
  ) {
    setExpired((prev) => ({
      ...prev,
      [barangId]: value,
    }));
  }

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* HEADER */}

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
            <PackageCheck size={24} />
          </div>

          <div>

            <h1 className="
              text-2xl
              font-bold
              tracking-tight
              text-[#18352D]
              md:text-3xl
            ">
              Barang Masuk
            </h1>

            <p className="
              mt-1
              text-sm
              text-gray-500
            ">
              Penerimaan barang berdasarkan Purchase Order
            </p>

          </div>

        </div>

        <button
          type="button"
          onClick={loadPurchase}
          disabled={loadingPurchase}
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
              loadingPurchase
                ? "animate-spin"
                : ""
            }
          />

          Refresh

        </button>

      </div>

      {/* PO APPROVED */}

      <div className="
        mb-6
        rounded-2xl
        border
        border-[#DDE9E4]
        bg-white
        shadow-sm
      ">

        <div className="
          border-b
          border-[#E5ECE9]
          p-5
        ">

          <div className="flex items-center justify-between">

            <div>

              <h2 className="
                font-semibold
                text-[#18352D]
              ">
                Purchase Order Siap Diterima
              </h2>

              <p className="
                mt-1
                text-sm
                text-gray-500
              ">
                Pilih PO yang sudah di-approve untuk menerima barang.
              </p>

            </div>

            <div className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              bg-[#EAF3EF]
              text-[#497F70]
            ">
              <ShoppingCart size={20} />
            </div>

          </div>

        </div>

        <div className="p-5">

          {loadingPurchase ? (

            <div className="
              flex
              flex-col
              items-center
              justify-center
              py-12
              text-gray-500
            ">

              <RefreshCw
                size={25}
                className="
                  mb-3
                  animate-spin
                  text-[#497F70]
                "
              />

              <span className="text-sm">
                Memuat Purchase Order...
              </span>

            </div>

          ) : purchase.length === 0 ? (

            <div className="
              flex
              flex-col
              items-center
              justify-center
              rounded-xl
              border
              border-dashed
              border-[#DDE9E4]
              bg-[#FAFCFB]
              py-12
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
                <CheckCircle2 size={26} />
              </div>

              <p className="
                mt-4
                font-semibold
                text-gray-700
              ">
                Tidak ada PO yang siap diterima
              </p>

              <p className="
                mt-1
                text-sm
                text-gray-400
              ">
                Semua Purchase Order yang approved sudah diproses.
              </p>

            </div>

          ) : (

            <div className="grid gap-3">

              {purchase.map((po: any) => {

                const isSelected =
                  selected?.id === po.id;

                return (
                  <button
                    type="button"
                    key={po.id}
                    onClick={() => pilihPO(po)}
                    className={`
                      w-full
                      rounded-xl
                      border
                      p-4
                      text-left
                      transition
                      ${
                        isSelected
                          ? "border-[#497F70] bg-[#EAF3EF] shadow-sm"
                          : "border-[#E1E9E5] bg-white hover:border-[#AFCBC0] hover:bg-[#FAFCFB]"
                      }
                    `}
                  >

                    <div className="
                      flex
                      flex-col
                      gap-3
                      md:flex-row
                      md:items-center
                      md:justify-between
                    ">

                      <div>

                        <div className="
                          flex
                          items-center
                          gap-2
                        ">

                          <span className="
                            font-bold
                            text-[#18352D]
                          ">
                            {po.number}
                          </span>

                          {isSelected && (
                            <span className="
                              rounded-full
                              bg-[#497F70]
                              px-2.5
                              py-1
                              text-[11px]
                              font-semibold
                              text-white
                            ">
                              DIPILIH
                            </span>
                          )}

                        </div>

                        <p className="
                          mt-1
                          text-sm
                          text-gray-500
                        ">
                          {po.supplier?.name ??
                            po.supplierName ??
                            "-"}
                        </p>

                      </div>

                      <div className="
                        flex
                        items-center
                        gap-5
                        text-sm
                      ">

                        <div>

                          <p className="text-xs text-gray-400">
                            Tanggal
                          </p>

                          <p className="mt-1 font-medium text-gray-700">
                            {po.date
                              ? new Date(
                                  po.date
                                ).toLocaleDateString(
                                  "id-ID"
                                )
                              : po.purchaseDate
                              ? new Date(
                                  po.purchaseDate
                                ).toLocaleDateString(
                                  "id-ID"
                                )
                              : "-"}
                          </p>

                        </div>

                        <div>

                          <p className="text-xs text-gray-400">
                            Status
                          </p>

                          <span className="
                            mt-1
                            inline-flex
                            rounded-full
                            bg-emerald-50
                            px-3
                            py-1
                            text-xs
                            font-semibold
                            text-emerald-700
                          ">
                            APPROVED
                          </span>

                        </div>

                      </div>

                    </div>

                  </button>
                );
              })}

            </div>

          )}

        </div>

      </div>

      {/* DETAIL PENERIMAAN */}

      {selected && (

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
            bg-[#FAFCFB]
            p-5
          ">

            <div className="
              flex
              flex-col
              gap-3
              md:flex-row
              md:items-center
              md:justify-between
            ">

              <div>

                <p className="
                  text-xs
                  font-semibold
                  uppercase
                  tracking-wider
                  text-[#497F70]
                ">
                  Penerimaan Barang
                </p>

                <h2 className="
                  mt-1
                  text-xl
                  font-bold
                  text-[#18352D]
                ">
                  PO {selected.number}
                </h2>

              </div>

              <div className="
                rounded-xl
                bg-[#EAF3EF]
                px-4
                py-2
                text-sm
                font-semibold
                text-[#497F70]
              ">
                {selected.items?.length ?? 0} Item
              </div>

            </div>

          </div>

          <div className="p-5">

            <div className="
              overflow-hidden
              rounded-xl
              border
              border-[#E1E9E5]
            ">

              <div className="overflow-x-auto">

                <table className="min-w-[850px] w-full text-sm">

                  <thead className="bg-[#F5F8F6]">

                    <tr className="
                      border-b
                      border-[#E5ECE9]
                    ">

                      <th className="
                        px-4
                        py-3
                        text-center
                        font-semibold
                        text-[#35564C]
                      ">
                        No
                      </th>

                      <th className="
                        px-4
                        py-3
                        text-left
                        font-semibold
                        text-[#35564C]
                      ">
                        Barang
                      </th>

                      <th className="
                        px-4
                        py-3
                        text-right
                        font-semibold
                        text-[#35564C]
                      ">
                        Qty PO
                      </th>

                      <th className="
                        px-4
                        py-3
                        text-center
                        font-semibold
                        text-[#35564C]
                      ">
                        Qty Diterima
                      </th>

                      <th className="
                        px-4
                        py-3
                        text-center
                        font-semibold
                        text-[#35564C]
                      ">
                        Expired Date
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {selected.items?.map(
                      (
                        item: any,
                        index: number
                      ) => {

                        const barangId =
                          item.barangId;

                        const hasExpired =
                          Boolean(
                            item.barang?.hasExpired
                          );

                        return (

                          <tr
                            key={item.id}
                            className="
                              border-b
                              border-[#EDF2EF]
                            "
                          >

                            <td className="
                              px-4
                              py-4
                              text-center
                              text-gray-400
                            ">
                              {index + 1}
                            </td>

                            <td className="px-4 py-4">

                              <p className="
                                font-semibold
                                text-[#18352D]
                              ">
                                {item.barang?.name ??
                                  "-"}
                              </p>

                              {item.barang?.code && (
                                <p className="
                                  mt-1
                                  text-xs
                                  text-gray-400
                                ">
                                  {item.barang.code}
                                </p>
                              )}

                            </td>

                            <td className="
                              px-4
                              py-4
                              text-right
                              font-medium
                              text-gray-700
                            ">

                              {Number(
                                item.qty ?? 0
                              ).toLocaleString(
                                "id-ID"
                              )}

                            </td>

                            <td className="
                              px-4
                              py-4
                              text-center
                            ">

                              <input
                                type="number"
                                min="1"
                                value={
                                  qty[barangId] ??
                                  ""
                                }
                                onChange={(e) =>
                                  updateQty(
                                    barangId,
                                    e.target.value
                                  )
                                }
                                className="
                                  w-32
                                  rounded-lg
                                  border
                                  border-[#D5E5DC]
                                  bg-white
                                  px-3
                                  py-2
                                  text-center
                                  text-sm
                                  font-medium
                                  text-gray-700
                                  outline-none
                                  focus:border-[#497F70]
                                  focus:ring-2
                                  focus:ring-[#497F70]/10
                                "
                              />

                            </td>

                            <td className="
                              px-4
                              py-4
                              text-center
                            ">

                              {hasExpired ? (

                                <div className="
                                  flex
                                  items-center
                                  justify-center
                                  gap-2
                                ">

                                  <CalendarDays
                                    size={16}
                                    className="text-[#497F70]"
                                  />

                                  <input
                                    type="date"
                                    value={
                                      expired[
                                        barangId
                                      ] ?? ""
                                    }
                                    onChange={(e) =>
                                      updateExpired(
                                        barangId,
                                        e.target.value
                                      )
                                    }
                                    className="
                                      rounded-lg
                                      border
                                      border-[#D5E5DC]
                                      bg-white
                                      px-3
                                      py-2
                                      text-sm
                                      text-gray-700
                                      outline-none
                                      focus:border-[#497F70]
                                      focus:ring-2
                                      focus:ring-[#497F70]/10
                                    "
                                  />

                                </div>

                              ) : (

                                <span className="
                                  text-xs
                                  text-gray-400
                                ">
                                  Tidak menggunakan expired
                                </span>

                              )}

                            </td>

                          </tr>

                        );
                      }
                    )}

                  </tbody>

                </table>

              </div>

            </div>

            {selected.items?.some(
              (item: any) =>
                item.barang?.hasExpired
            ) && (

              <div className="
                mt-4
                flex
                items-start
                gap-3
                rounded-xl
                border
                border-amber-200
                bg-amber-50
                p-4
              ">

                <AlertTriangle
                  size={19}
                  className="
                    mt-0.5
                    shrink-0
                    text-amber-600
                  "
                />

                <div>

                  <p className="
                    text-sm
                    font-semibold
                    text-amber-800
                  ">
                    Perhatian Expired Date
                  </p>

                  <p className="
                    mt-1
                    text-xs
                    leading-5
                    text-amber-700
                  ">
                    Barang yang menggunakan sistem
                    expired wajib diisi tanggal
                    expired saat penerimaan.
                  </p>

                </div>

              </div>

            )}

            <div className="
              mt-6
              flex
              flex-col-reverse
              gap-3
              sm:flex-row
              sm:justify-end
            ">

              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setQty({});
                  setExpired({});
                }}
                disabled={loading}
                className="
                  rounded-xl
                  border
                  border-[#D5E5DC]
                  bg-white
                  px-5
                  py-3
                  text-sm
                  font-medium
                  text-gray-700
                  transition
                  hover:bg-[#F5F8F6]
                  disabled:opacity-50
                "
              >
                Batal
              </button>

              <button
                type="button"
                onClick={receive}
                disabled={loading}
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  bg-[#497F70]
                  px-6
                  py-3
                  text-sm
                  font-semibold
                  text-white
                  shadow-sm
                  transition
                  hover:bg-[#3E6F62]
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
                    Memproses...
                  </>
                ) : (
                  <>
                    <PackageCheck size={17} />
                    Terima Barang
                  </>
                )}

              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}