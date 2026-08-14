"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Barcode,
  Pencil,
  Trash2,
  Printer,
} from "lucide-react";

export default function BarangTable({
  data,
  reload,
}: {
  data: any[];
  reload: () => void;
}) {
  const router = useRouter();

  const [selected, setSelected] = useState<number[]>([]);

  function toggle(id: number) {
    setSelected((old) =>
      old.includes(id)
        ? old.filter((x) => x !== id)
        : [...old, id]
    );
  }

  function toggleAll() {
    if (selected.length === data.length) {
      setSelected([]);
    } else {
      setSelected(data.map((item) => item.id));
    }
  }

  // ==========================================
  // CETAK BARCODE TERPILIH
  // ==========================================

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

  // ==========================================
  // CETAK BARCODE SATU BARANG
  // ==========================================

  function cetakBarcodeSatu(id: number) {
    router.push(
      `/master-barang/barcode?ids=${id}`
    );
  }

  // ==========================================
  // HAPUS BARANG
  // ==========================================

  async function hapus(id: number) {
    const ok = confirm("Hapus barang ini?");

    if (!ok) return;

    try {
      const res = await fetch(
        `/api/master/barang/${id}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();

      if (json.success) {
        reload();

        setSelected((old) =>
          old.filter((x) => x !== id)
        );
      } else {
        alert(
          json.message ||
            "Gagal menghapus barang"
        );
      }
    } catch (error) {
      console.error(error);

      alert("Gagal menghapus barang");
    }
  }

  return (
    <div>
      {/* =========================================
          TOOLBAR
      ========================================= */}

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
        <div
          className="
            text-sm
            text-gray-500
          "
        >
          Total Barang{" "}
          <span
            className="
              font-semibold
              text-[#18352D]
            "
          >
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
            hover:bg-[#F5F8F6]
            hover:border-[#497F70]
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

      {/* =========================================
          TABLE
      ========================================= */}

      <div className="overflow-x-auto">
        <table
          className="
            min-w-[1100px]
            w-full
            text-sm
          "
        >
          <thead
            className="
              bg-[#F5F8F6]
            "
          >
            <tr
              className="
                border-b
                border-[#E5ECE9]
              "
            >
              <th
                className="
                  px-5
                  py-4
                  text-center
                  font-semibold
                  text-[#35564C]
                "
              >
                <input
                  type="checkbox"
                  checked={
                    data.length > 0 &&
                    selected.length === data.length
                  }
                  onChange={toggleAll}
                  className="
                    h-4
                    w-4
                    accent-[#497F70]
                  "
                />
              </th>

              <th
                className="
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-[#35564C]
                "
              >
                Kode
              </th>

              <th
                className="
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-[#35564C]
                "
              >
                Barcode
              </th>

              <th
                className="
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-[#35564C]
                "
              >
                Nama
              </th>

              <th
                className="
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-[#35564C]
                "
              >
                Kategori
              </th>

              <th
                className="
                  px-5
                  py-4
                  text-left
                  font-semibold
                  text-[#35564C]
                "
              >
                Satuan
              </th>

              <th
                className="
                  px-5
                  py-4
                  text-right
                  font-semibold
                  text-[#35564C]
                "
              >
                Stock
              </th>

              <th
                className="
                  px-5
                  py-4
                  text-right
                  font-semibold
                  text-[#35564C]
                "
              >
                Harga Beli
              </th>

              <th
                className="
                  px-5
                  py-4
                  text-right
                  font-semibold
                  text-[#35564C]
                "
              >
                Harga Jual
              </th>

              <th
                className="
                  px-5
                  py-4
                  text-center
                  font-semibold
                  text-[#35564C]
                "
              >
                Aksi
              </th>
            </tr>
          </thead>

          <tbody>
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={10}
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

            {data.map((item) => (
              <tr
                key={item.id}
                className={`
                  border-b
                  border-[#EDF2EF]
                  transition
                  hover:bg-[#FAFCFB]

                  ${
                    selected.includes(item.id)
                      ? "bg-[#F0F7F3]"
                      : ""
                  }
                `}
              >
                {/* CHECKBOX */}

                <td
                  className="
                    px-5
                    py-4
                    text-center
                  "
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(
                      item.id
                    )}
                    onChange={() =>
                      toggle(item.id)
                    }
                    className="
                      h-4
                      w-4
                      accent-[#497F70]
                    "
                  />
                </td>

                {/* KODE */}

                <td
                  className="
                    px-5
                    py-4
                    font-medium
                    text-[#18352D]
                  "
                >
                  {item.code}
                </td>

                {/* BARCODE */}

                <td
                  className="
                    px-5
                    py-4
                    text-gray-500
                  "
                >
                  {item.barcode || "-"}
                </td>

                {/* NAMA */}

                <td
                  className="
                    px-5
                    py-4
                  "
                >
                  <div
                    className="
                      font-semibold
                      text-[#18352D]
                    "
                  >
                    {item.name}
                  </div>
                </td>

                {/* KATEGORI */}

                <td
                  className="
                    px-5
                    py-4
                    text-gray-600
                  "
                >
                  {typeof item.category ===
                  "object"
                    ? item.category?.name
                    : item.category || "-"}
                </td>

                {/* SATUAN */}

                <td
                  className="
                    px-5
                    py-4
                    text-gray-600
                  "
                >
                  {typeof item.unit === "object"
                    ? item.unit?.name
                    : item.unit || "-"}
                </td>

                {/* STOCK */}

                <td
                  className="
                    px-5
                    py-4
                    text-right
                  "
                >
                  <span
                    className="
                      inline-flex
                      min-w-[60px]
                      justify-center
                      rounded-lg
                      bg-[#EAF3EF]
                      px-2.5
                      py-1
                      font-semibold
                      text-[#35564C]
                    "
                  >
                    {item.stock ?? 0}
                  </span>
                </td>

                {/* HARGA BELI */}

                <td
                  className="
                    px-5
                    py-4
                    text-right
                    text-gray-600
                  "
                >
                  Rp{" "}
                  {Number(
                    item.purchasePrice ?? 0
                  ).toLocaleString("id-ID")}
                </td>

                {/* HARGA JUAL */}

                <td
                  className="
                    px-5
                    py-4
                    text-right
                    text-gray-600
                  "
                >
                  Rp{" "}
                  {Number(
                    item.sellingPrice ?? 0
                  ).toLocaleString("id-ID")}
                </td>

                {/* AKSI */}

                <td
                  className="
                    px-5
                    py-4
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
                    {/* BARCODE */}

                    <button
                      type="button"
                      title="Cetak Barcode"
                      onClick={() =>
                        cetakBarcodeSatu(
                          item.id
                        )
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
                        hover:bg-[#EAF3EF]
                        hover:border-[#497F70]
                      "
                    >
                      <Barcode size={17} />
                    </button>

                    {/* EDIT */}

                    <Link
                      href={`/master-barang/${item.id}/edit`}
                      title="Edit Barang"
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
                        hover:bg-[#EAF3EF]
                        hover:border-[#497F70]
                      "
                    >
                      <Pencil size={16} />
                    </Link>

                    {/* HAPUS */}

                    <button
                      type="button"
                      title="Hapus Barang"
                      onClick={() =>
                        hapus(item.id)
                      }
                      className="
                        inline-flex
                        h-9
                        w-9
                        items-center
                        justify-center
                        rounded-lg
                        border
                        border-red-100
                        bg-white
                        text-red-500
                        transition
                        hover:bg-red-50
                        hover:border-red-200
                      "
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}