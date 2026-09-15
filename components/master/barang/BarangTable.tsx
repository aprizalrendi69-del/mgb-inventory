"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Barcode,
  Pencil,
  Trash2,
  Printer,
  Warehouse,
  Store,
  ShieldCheck,
  ShieldAlert,
  History,
  Power,
  RotateCcw,
  Loader2,
} from "lucide-react";

export default function BarangTable({
  data,
  reload,
}: {
  data: any[];
  reload: () => void | Promise<void>;
}) {
  const router = useRouter();

  const [selected, setSelected] = useState<number[]>([]);
  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  const [activatingId, setActivatingId] =
    useState<number | null>(null);

  /*
   * =========================================================
   * SELECT BARANG
   * =========================================================
   */

  function toggle(id: number) {
    setSelected((old) =>
      old.includes(id)
        ? old.filter((x) => x !== id)
        : [...old, id]
    );
  }

  /*
   * =========================================================
   * SELECT SEMUA
   * =========================================================
   */

  function toggleAll() {
    if (selected.length === data.length) {
      setSelected([]);
    } else {
      setSelected(
        data.map((item) => Number(item.id))
      );
    }
  }

  /*
   * =========================================================
   * CETAK BARCODE
   * =========================================================
   */

  function cetakBarcode() {
    if (selected.length === 0) {
      alert("Pilih minimal satu barang");
      return;
    }

    const ids = selected.join(",");

    router.push(
      `/master-barang/barcode?ids=${ids}`
    );
  }

  /*
   * =========================================================
   * CETAK BARCODE SATU BARANG
   * =========================================================
   */

  function cetakBarcodeSatu(id: number) {
    router.push(
      `/master-barang/barcode?ids=${id}`
    );
  }

  /*
   * =========================================================
   * FORMAT HISTORY
   * =========================================================
   */

  function getHistoryText(item: any) {
    if (
      !item?.deleteUsage ||
      !Array.isArray(item.deleteUsage)
    ) {
      return "";
    }

    return item.deleteUsage
      .map((usage: any) => {
        const label =
          usage?.label || "Data lain";

        const count =
          Number(usage?.count || 0);

        return `${label}: ${count}`;
      })
      .join("\n");
  }

  /*
   * =========================================================
   * AKTIFKAN BARANG
   * =========================================================
   *
   * Hanya mengubah:
   *
   * Barang.active = true
   *
   * Tidak menyentuh:
   * - stock
   * - harga
   * - histori
   * - BOM
   * - recipe
   * - POS
   * - transfer
   * - purchase
   * - relasi lainnya
   */

  async function aktifkanBarang(id: number) {
    if (
      activatingId !== null ||
      deletingId !== null
    ) {
      return;
    }

    const item = data.find(
      (barang) =>
        Number(barang.id) === Number(id)
    );

    if (!item) {
      alert("Data barang tidak ditemukan.");
      return;
    }

    if (item.active === true) {
      return;
    }

    const namaBarang =
      `${item.code ?? ""} - ${item.name ?? ""}`;

    const ok = confirm(
      `Barang berikut saat ini NONAKTIF:\n\n` +
        `${namaBarang}\n\n` +
        `Aktifkan kembali barang ini?\n\n` +
        `Data stock dan histori tidak akan diubah.`
    );

    if (!ok) {
      return;
    }

    try {
      setActivatingId(id);

      const res = await fetch(
        `/api/master/barang?id=${encodeURIComponent(
          id
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            active: true,
          }),
          cache: "no-store",
        }
      );

      let json: any = null;

      try {
        json = await res.json();
      } catch {
        json = null;
      }

      console.log(
        "AKTIFKAN MASTER BARANG:",
        {
          status: res.status,
          response: json,
        }
      );

      if (
        !res.ok ||
        !json?.success
      ) {
        alert(
          json?.message ||
            "Barang gagal diaktifkan."
        );

        return;
      }

      alert(
        json.message ||
          `Barang "${namaBarang}" berhasil diaktifkan kembali.`
      );

      /*
       * Jika sebelumnya dipilih,
       * keluarkan dari selected.
       */

      setSelected((old) =>
        old.filter(
          (selectedId) =>
            Number(selectedId) !==
            Number(id)
        )
      );

      await reload();
    } catch (error) {
      console.error(
        "AKTIFKAN MASTER BARANG ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat mengaktifkan barang. Silakan coba lagi."
      );
    } finally {
      setActivatingId(null);
    }
  }

  /*
   * =========================================================
   * NONAKTIFKAN BARANG
   * =========================================================
   *
   * Disediakan supaya status bisa dikelola dari tabel.
   *
   * Tidak menghapus data.
   */

  async function nonaktifkanBarang(id: number) {
    if (
      activatingId !== null ||
      deletingId !== null
    ) {
      return;
    }

    const item = data.find(
      (barang) =>
        Number(barang.id) === Number(id)
    );

    if (!item) {
      alert("Data barang tidak ditemukan.");
      return;
    }

    if (item.active === false) {
      return;
    }

    const namaBarang =
      `${item.code ?? ""} - ${item.name ?? ""}`;

    const ok = confirm(
      `Nonaktifkan barang berikut?\n\n` +
        `${namaBarang}\n\n` +
        `Barang tidak akan dihapus.\n` +
        `Stock dan histori tetap aman.`
    );

    if (!ok) {
      return;
    }

    try {
      setActivatingId(id);

      const res = await fetch(
        `/api/master/barang?id=${encodeURIComponent(
          id
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            active: false,
          }),
          cache: "no-store",
        }
      );

      let json: any = null;

      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (
        !res.ok ||
        !json?.success
      ) {
        alert(
          json?.message ||
            "Barang gagal dinonaktifkan."
        );

        return;
      }

      alert(
        json.message ||
          `Barang "${namaBarang}" berhasil dinonaktifkan.`
      );

      setSelected((old) =>
        old.filter(
          (selectedId) =>
            Number(selectedId) !==
            Number(id)
        )
      );

      await reload();
    } catch (error) {
      console.error(
        "NONAKTIFKAN MASTER BARANG ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menonaktifkan barang."
      );
    } finally {
      setActivatingId(null);
    }
  }

  /*
   * =========================================================
   * HAPUS BARANG
   * =========================================================
   */

  async function hapus(id: number) {
    if (deletingId !== null) {
      return;
    }

    const item = data.find(
      (barang) =>
        Number(barang.id) === Number(id)
    );

    if (!item) {
      alert("Data barang tidak ditemukan.");
      return;
    }

    if (item.canDelete === false) {
      const historyText =
        getHistoryText(item);

      if (item.hasStock) {
        alert(
          `Barang "${item.code} - ${item.name}" tidak dapat dihapus.\n\n` +
            `${
              item.deleteReason ||
              "Barang masih memiliki stock."
            }`
        );

        return;
      }

      alert(
        `Barang "${item.code} - ${item.name}" tidak dapat dihapus.\n\n` +
          `${
            item.deleteReason ||
            "Barang sudah memiliki history."
          }` +
          (historyText
            ? `\n\nDigunakan pada:\n${historyText}`
            : "")
      );

      return;
    }

    const namaBarang =
      `${item.code ?? ""} - ${item.name ?? ""}`;

    const ok = confirm(
      `Barang ini belum memiliki history dan stock kosong.\n\n` +
        `${namaBarang}\n\n` +
        `Barang aman untuk dihapus.\n\n` +
        `Apakah Anda yakin ingin menghapus barang ini?`
    );

    if (!ok) {
      return;
    }

    try {
      setDeletingId(id);

      const res = await fetch(
        `/api/master/barang?id=${encodeURIComponent(
          id
        )}`,
        {
          method: "DELETE",
          cache: "no-store",
        }
      );

      let json: any = null;

      try {
        json = await res.json();
      } catch {
        json = null;
      }

      console.log(
        "DELETE MASTER BARANG:",
        {
          status: res.status,
          response: json,
        }
      );

      if (
        !res.ok ||
        !json?.success
      ) {
        if (
          json?.hasHistory ||
          (
            json?.usedIn &&
            Array.isArray(json.usedIn) &&
            json.usedIn.length > 0
          )
        ) {
          const usageDetail =
            Array.isArray(json.usedIn)
              ? json.usedIn
                  .map((usage: any) => {
                    const label =
                      usage?.label ??
                      "Data lain";

                    const count =
                      Number(
                        usage?.count ?? 0
                      );

                    return `- ${label}: ${count}`;
                  })
                  .join("\n")
              : "";

          alert(
            `${json.message || "Barang tidak dapat dihapus."}` +
              (usageDetail
                ? `\n\nDigunakan pada:\n${usageDetail}`
                : "")
          );

          return;
        }

        if (json?.hasStock) {
          alert(
            json.message ||
              "Barang masih memiliki stock."
          );

          return;
        }

        alert(
          json?.message ||
            "Barang tidak dapat dihapus."
        );

        return;
      }

      alert(
        json.message ||
          "Master barang berhasil dihapus."
      );

      setSelected((old) =>
        old.filter(
          (selectedId) =>
            Number(selectedId) !==
            Number(id)
        )
      );

      await reload();
    } catch (error) {
      console.error(
        "DELETE MASTER BARANG ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menghapus barang. Silakan coba lagi."
      );
    } finally {
      setDeletingId(null);
    }
  }

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <div>
      {/* =====================================================
          TOOLBAR
      ===================================================== */}

      <div
        className="
          flex
          flex-col
          gap-3
          px-5
          py-4
          md:flex-row
          md:items-center
          md:justify-between
        "
      >
        <div className="text-sm text-gray-500">
          Total Barang{" "}
          <span className="font-semibold text-[#18352D]">
            {data.length}
          </span>
        </div>

        <button
          type="button"
          onClick={cetakBarcode}
          disabled={selected.length === 0}
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
            text-[#497F70]
            shadow-sm
            transition
            hover:border-[#497F70]
            hover:bg-[#F5F8F6]
            disabled:cursor-not-allowed
            disabled:opacity-40
          "
        >
          <Printer size={16} />

          Cetak Barcode

          {selected.length > 0 && (
            <span
              className="
                rounded-full
                bg-[#EAF3EF]
                px-2
                py-0.5
                text-xs
                text-[#497F70]
              "
            >
              {selected.length}
            </span>
          )}
        </button>
      </div>

      {/* =====================================================
          INFO STATUS
      ===================================================== */}

      <div
        className="
          grid
          grid-cols-1
          gap-3
          border-y
          border-[#E5ECE9]
          bg-[#FAFCFB]
          px-5
          py-4
          md:grid-cols-3
        "
      >
        {/* AMAN */}

        <div
          className="
            flex
            items-start
            gap-3
            rounded-xl
            border
            border-emerald-100
            bg-emerald-50
            p-3
          "
        >
          <div
            className="
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-lg
              bg-emerald-100
              text-emerald-700
            "
          >
            <ShieldCheck size={18} />
          </div>

          <div>
            <div className="text-sm font-semibold text-emerald-800">
              Aman Dihapus
            </div>

            <div className="mt-0.5 text-xs text-emerald-700">
              Belum memiliki history dan stock
              kosong.
            </div>
          </div>
        </div>

        {/* HISTORY */}

        <div
          className="
            flex
            items-start
            gap-3
            rounded-xl
            border
            border-red-100
            bg-red-50
            p-3
          "
        >
          <div
            className="
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-lg
              bg-red-100
              text-red-700
            "
          >
            <History size={18} />
          </div>

          <div>
            <div className="text-sm font-semibold text-red-800">
              Sudah Ada History
            </div>

            <div className="mt-0.5 text-xs text-red-700">
              Tidak dapat dihapus karena sudah
              digunakan.
            </div>
          </div>
        </div>

        {/* STATUS AKTIF */}

        <div
          className="
            flex
            items-start
            gap-3
            rounded-xl
            border
            border-blue-100
            bg-blue-50
            p-3
          "
        >
          <div
            className="
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-lg
              bg-blue-100
              text-blue-700
            "
          >
            <Power size={18} />
          </div>

          <div>
            <div className="text-sm font-semibold text-blue-800">
              Status Barang
            </div>

            <div className="mt-0.5 text-xs text-blue-700">
              Barang nonaktif tetap tersimpan dan
              dapat diaktifkan kembali.
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          TABLE
      ===================================================== */}

      <div className="overflow-x-auto">
        <table className="min-w-[1750px] w-full text-sm">
          <thead className="bg-[#F5F8F6]">
            <tr className="border-b border-[#E5ECE9]">

              {/* CHECKBOX */}

              <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                <input
                  type="checkbox"
                  checked={
                    data.length > 0 &&
                    selected.length ===
                      data.length
                  }
                  onChange={toggleAll}
                  className="h-4 w-4 accent-[#497F70]"
                />
              </th>

              {/* KODE */}

              <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                Kode
              </th>

              {/* BARCODE */}

              <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                Barcode
              </th>

              {/* NAMA */}

              <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                Nama
              </th>

              {/* STATUS AKTIF */}

              <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                Status
              </th>

              {/* STATUS DELETE */}

              <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                Status Data
              </th>

              {/* KATEGORI */}

              <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                Kategori
              </th>

              {/* SATUAN TRANSAKSI */}

              <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                Satuan Transaksi
              </th>

              {/* SATUAN DASAR */}

              <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                Satuan Dasar
              </th>

              {/* KONVERSI */}

              <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                Konversi
              </th>

              {/* SUMBER */}

              <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                Sumber
              </th>

              {/* OUTLET */}

              <th className="px-5 py-4 text-left font-semibold text-[#35564C]">
                Outlet
              </th>

              {/* STOCK */}

              <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                Stock
              </th>

              {/* HARGA BELI */}

              <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                Harga Beli
              </th>

              {/* HARGA JUAL */}

              <th className="px-5 py-4 text-right font-semibold text-[#35564C]">
                Harga Jual
              </th>

              {/* AKSI */}

              <th className="px-5 py-4 text-center font-semibold text-[#35564C]">
                Aksi
              </th>
            </tr>
          </thead>

          <tbody>
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={17}
                  className="
                    px-5
                    py-14
                    text-center
                    text-gray-400
                  "
                >
                  Tidak ada data barang
                </td>
              </tr>
            )}

            {data.map((item) => {
              const itemId =
                Number(item.id);

              const isOutlet =
                item.source === "OUTLET";

              const isDeleting =
                deletingId === itemId;

              const isActivating =
                activatingId === itemId;

              /*
               * =================================================
               * STATUS AKTIF
               * =================================================
               */

              const isActive =
                item.active !== false;

              /*
               * =================================================
               * DELETE STATUS
               * =================================================
               */

              const canDelete =
                item.canDelete === true;

              const hasHistory =
                item.hasHistory === true;

              const hasStock =
                item.hasStock === true;

              const conversionRate =
                Number(
                  item.conversionRate ?? 1
                ) || 1;

              const baseUnit =
                item.baseUnit ||
                item.unit ||
                "-";

              return (
                <tr
                  key={item.id}
                  className={`
                    border-b
                    border-[#EDF2EF]
                    transition

                    ${
                      isActive
                        ? "hover:bg-[#FAFCFB]"
                        : "bg-slate-50 hover:bg-slate-100"
                    }

                    ${
                      selected.includes(
                        itemId
                      )
                        ? "bg-[#F0F7F3]"
                        : ""
                    }

                    ${
                      isDeleting ||
                      isActivating
                        ? "opacity-60"
                        : ""
                    }
                  `}
                >
                  {/* CHECKBOX */}

                  <td className="px-5 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={selected.includes(
                        itemId
                      )}
                      onChange={() =>
                        toggle(itemId)
                      }
                      disabled={
                        isDeleting ||
                        isActivating
                      }
                      className="h-4 w-4 accent-[#497F70]"
                    />
                  </td>

                  {/* KODE */}

                  <td className="px-5 py-4 font-medium text-[#18352D]">
                    {item.code}
                  </td>

                  {/* BARCODE */}

                  <td className="px-5 py-4 text-gray-500">
                    {item.barcode || "-"}
                  </td>

                  {/* NAMA */}

                  <td className="px-5 py-4">
                    <div
                      className={`font-semibold ${
                        isActive
                          ? "text-[#18352D]"
                          : "text-slate-500"
                      }`}
                    >
                      {item.name}
                    </div>

                    {!isActive && (
                      <div className="mt-1 text-[11px] font-medium text-slate-400">
                        Barang tidak aktif
                      </div>
                    )}
                  </td>

                  {/* =================================================
                      STATUS AKTIF
                  ================================================= */}

                  <td className="px-5 py-4">
                    {isActive ? (
                      <span
                        className="
                          inline-flex
                          items-center
                          gap-1.5
                          rounded-full
                          border
                          border-emerald-200
                          bg-emerald-50
                          px-3
                          py-1.5
                          text-xs
                          font-bold
                          text-emerald-700
                        "
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        AKTIF
                      </span>
                    ) : (
                      <span
                        className="
                          inline-flex
                          items-center
                          gap-1.5
                          rounded-full
                          border
                          border-slate-200
                          bg-slate-100
                          px-3
                          py-1.5
                          text-xs
                          font-bold
                          text-slate-500
                        "
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        NONAKTIF
                      </span>
                    )}
                  </td>

                  {/* =================================================
                      STATUS DATA
                  ================================================= */}

                  <td className="px-5 py-4">
                    {canDelete ? (
                      <div className="flex flex-col gap-1">
                        <span
                          className="
                            inline-flex
                            w-fit
                            items-center
                            gap-1.5
                            rounded-full
                            bg-emerald-100
                            px-2.5
                            py-1
                            text-xs
                            font-bold
                            text-emerald-700
                          "
                        >
                          <ShieldCheck size={13} />

                          AMAN DIHAPUS
                        </span>

                        <span className="text-[11px] text-emerald-600">
                          Belum ada history
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span
                          className="
                            inline-flex
                            w-fit
                            items-center
                            gap-1.5
                            rounded-full
                            bg-red-100
                            px-2.5
                            py-1
                            text-xs
                            font-bold
                            text-red-700
                          "
                        >
                          <ShieldAlert size={13} />

                          SUDAH ADA HISTORY
                        </span>

                        <span className="max-w-[220px] text-[11px] leading-4 text-red-600">
                          {hasStock
                            ? "Stock masih tersedia"
                            : hasHistory
                            ? "Sudah digunakan"
                            : "Tidak dapat dihapus"}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* KATEGORI */}

                  <td className="px-5 py-4 text-gray-600">
                    {typeof item.category ===
                    "object"
                      ? item.category?.name
                      : item.category || "-"}
                  </td>

                  {/* SATUAN TRANSAKSI */}

                  <td className="px-5 py-4 text-gray-600">
                    {item.unit || "-"}
                  </td>

                  {/* SATUAN DASAR */}

                  <td className="px-5 py-4">
                    <span className="font-semibold text-[#35564C]">
                      {baseUnit}
                    </span>
                  </td>

                  {/* KONVERSI */}

                  <td className="px-5 py-4 text-gray-600">
                    1{" "}
                    {item.unit ||
                      "Satuan"}{" "}
                    ={" "}
                    <span className="font-semibold text-[#18352D]">
                      {conversionRate.toLocaleString(
                        "id-ID"
                      )}
                    </span>{" "}
                    {baseUnit}
                  </td>

                  {/* SUMBER */}

                  <td className="px-5 py-4">
                    {isOutlet ? (
                      <span
                        className="
                          inline-flex
                          items-center
                          gap-1.5
                          rounded-full
                          bg-[#FFF4E5]
                          px-2.5
                          py-1
                          text-xs
                          font-semibold
                          text-[#A86400]
                        "
                      >
                        <Store size={13} />

                        Outlet
                      </span>
                    ) : (
                      <span
                        className="
                          inline-flex
                          items-center
                          gap-1.5
                          rounded-full
                          bg-[#EAF3EF]
                          px-2.5
                          py-1
                          text-xs
                          font-semibold
                          text-[#497F70]
                        "
                      >
                        <Warehouse size={13} />

                        Pusat
                      </span>
                    )}
                  </td>

                  {/* OUTLET */}

                  <td className="px-5 py-4 text-gray-600">
                    {item.outlet?.name ||
                      "-"}
                  </td>

                  {/* STOCK */}

                  <td className="px-5 py-4 text-right">
                    <span
                      className={`
                        inline-flex
                        min-w-[60px]
                        justify-center
                        rounded-lg
                        px-2.5
                        py-1
                        font-semibold

                        ${
                          isActive
                            ? "bg-[#EAF3EF] text-[#35564C]"
                            : "bg-slate-100 text-slate-400"
                        }
                      `}
                    >
                      {item.stock ?? 0}{" "}
                      {item.unit || ""}
                    </span>
                  </td>

                  {/* HARGA BELI */}

                  <td className="px-5 py-4 text-right text-gray-600">
                    Rp{" "}
                    {Number(
                      item.purchasePrice ??
                        0
                    ).toLocaleString(
                      "id-ID"
                    )}
                  </td>

                  {/* HARGA JUAL */}

                  <td className="px-5 py-4 text-right text-gray-600">
                    Rp{" "}
                    {Number(
                      item.sellingPrice ??
                        0
                    ).toLocaleString(
                      "id-ID"
                    )}
                  </td>

                  {/* =================================================
                      AKSI
                  ================================================= */}

                  <td className="px-5 py-4">
                    <div
                      className="
                        flex
                        items-center
                        justify-center
                        gap-2
                      "
                    >
                      {/* BARCODE */}

                      <button
                        type="button"
                        title="Cetak Barcode"
                        onClick={() =>
                          cetakBarcodeSatu(
                            itemId
                          )
                        }
                        disabled={
                          isDeleting ||
                          isActivating
                        }
                        className="
                          inline-flex
                          h-9
                          w-9
                          items-center
                          justify-center
                          rounded-lg
                          border
                          border-[#D5E5DC]
                          bg-white
                          text-[#497F70]
                          transition
                          hover:border-[#497F70]
                          hover:bg-[#EAF3EF]
                          disabled:cursor-not-allowed
                          disabled:opacity-40
                        "
                      >
                        <Barcode
                          size={17}
                        />
                      </button>

                      {/* EDIT */}

                      <Link
                        href={`/master-barang/${itemId}/edit`}
                        title="Edit Barang"
                        aria-disabled={
                          isDeleting ||
                          isActivating
                        }
                        className={`
                          inline-flex
                          h-9
                          w-9
                          items-center
                          justify-center
                          rounded-lg
                          border
                          border-[#D5E5DC]
                          bg-white
                          text-[#497F70]
                          transition
                          hover:border-[#497F70]
                          hover:bg-[#EAF3EF]

                          ${
                            isDeleting ||
                            isActivating
                              ? "pointer-events-none opacity-40"
                              : ""
                          }
                        `}
                      >
                        <Pencil
                          size={16}
                        />
                      </Link>

                      {/* =================================================
                          AKTIFKAN / NONAKTIFKAN
                      ================================================= */}

                      {isActive ? (
                        <button
                          type="button"
                          title="Nonaktifkan Barang"
                          onClick={() =>
                            nonaktifkanBarang(
                              itemId
                            )
                          }
                          disabled={
                            isDeleting ||
                            isActivating
                          }
                          className="
                            inline-flex
                            h-9
                            w-9
                            items-center
                            justify-center
                            rounded-lg
                            border
                            border-amber-200
                            bg-amber-50
                            text-amber-600
                            transition
                            hover:border-amber-300
                            hover:bg-amber-100
                            disabled:cursor-not-allowed
                            disabled:opacity-40
                          "
                        >
                          {isActivating ? (
                            <Loader2
                              size={16}
                              className="animate-spin"
                            />
                          ) : (
                            <Power size={16} />
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          title="Aktifkan Barang"
                          onClick={() =>
                            aktifkanBarang(
                              itemId
                            )
                          }
                          disabled={
                            isDeleting ||
                            isActivating
                          }
                          className="
                            inline-flex
                            h-9
                            w-9
                            items-center
                            justify-center
                            rounded-lg
                            border
                            border-emerald-200
                            bg-emerald-50
                            text-emerald-600
                            transition
                            hover:border-emerald-300
                            hover:bg-emerald-100
                            disabled:cursor-not-allowed
                            disabled:opacity-40
                          "
                        >
                          {isActivating ? (
                            <Loader2
                              size={16}
                              className="animate-spin"
                            />
                          ) : (
                            <RotateCcw
                              size={16}
                            />
                          )}
                        </button>
                      )}

                      {/* =================================================
                          DELETE
                      ================================================= */}

                      <button
                        type="button"
                        title={
                          isDeleting
                            ? "Menghapus..."
                            : canDelete
                            ? "Aman dihapus"
                            : item.deleteReason ||
                              "Barang sudah memiliki history"
                        }
                        onClick={() =>
                          hapus(itemId)
                        }
                        disabled={
                          isDeleting ||
                          isActivating
                        }
                        className={`
                          inline-flex
                          h-9
                          w-9
                          items-center
                          justify-center
                          rounded-lg
                          border
                          transition

                          ${
                            canDelete
                              ? "border-emerald-200 bg-emerald-50 text-emerald-600 hover:border-emerald-300 hover:bg-emerald-100"
                              : "border-red-100 bg-red-50 text-red-400 hover:border-red-200 hover:bg-red-100"
                          }

                          disabled:cursor-not-allowed
                          disabled:opacity-50
                        `}
                      >
                        {isDeleting ? (
                          <Loader2
                            size={16}
                            className="animate-spin"
                          />
                        ) : canDelete ? (
                          <Trash2
                            size={16}
                          />
                        ) : (
                          <ShieldAlert
                            size={16}
                          />
                        )}
                      </button>
                    </div>

                    {/* =================================================
                        KETERANGAN AKSI
                    ================================================= */}

                    <div className="mt-2 text-center">
                      {isActivating ? (
                        <span className="text-[10px] font-semibold text-[#497F70]">
                          Memproses...
                        </span>
                      ) : isActive ? (
                        <span className="text-[10px] font-semibold text-amber-600">
                          Nonaktifkan
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-600">
                          Aktifkan kembali
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}